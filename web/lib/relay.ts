import type { Address, Hex, TransactionReceipt } from "viem";
import { forwarderAbi } from "./abi";
import { CHAIN_ID, contracts } from "./deployments";
import { publicClient } from "./room";
import { getSigner } from "./signer";

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:8787";

const types = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

/** What went wrong, in words a participant can act on. Never "transaction", "gas" or "sign". */
export class PlainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const PLAIN: Record<string, string> = {
  WrongCode: "Room not found. Check the code with your host.",
  UnknownCode: "Room not found. Check the code with your host.",
  RoomIsClosed: "This room has closed.",
  RoomFull: "This room is full.",
  InsufficientBudget: "The host hasn't added coins yet. Ask your host.",
  HostCannotJoin: "You're hosting this room.",
  TooEarly: "Answers are still being opened. Try again in a moment.",
  DisputeWindowOpen: "The result can still be disputed. Settle when the countdown ends.",
  HashMismatch: "This question can't be opened from this tab.",
  QuestionInFlight: "Finish the current question first.",
  rate_limited: "Too many tries at once. Wait a moment and try again.",
  daily_cap: "The game is busy right now. Try again in a little while.",
  room_cap: "This room has reached its limit for today. Ask your host.",
};

/** Signs `data` for `to` with the player's account and asks the relayer to submit it. Resolves once it is in. */
export async function send(to: Address, data: Hex, gas = 500_000n): Promise<TransactionReceipt> {
  const account = getSigner();
  if (!account) throw new PlainError("Sign in first, then try again.", "signed_out");
  const nonce = await publicClient.readContract({ address: contracts.Forwarder, abi: forwarderAbi, functionName: "nonces", args: [account.address] });
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const message = { from: account.address, to, value: 0n, gas, nonce, deadline, data };
  const signature = await account.signTypedData({
    domain: { name: "Kokonad", version: "1", chainId: CHAIN_ID, verifyingContract: contracts.Forwarder },
    types,
    primaryType: "ForwardRequest",
    message,
  });

  let res: Response;
  try {
    res = await fetch(`${RELAY_URL}/relay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: { from: account.address, to, value: "0", gas: gas.toString(), deadline, data, signature } }),
    });
  } catch {
    throw new PlainError("Something didn't go through. Your account is fine.", "network");
  }
  const body = (await res.json().catch(() => ({}))) as { status?: string; txHash?: Hex; reason?: string; detail?: string };
  if (body.status === "relayed" && body.txHash) {
    return publicClient.waitForTransactionReceipt({ hash: body.txHash });
  }
  const code = body.detail ?? body.reason ?? "unknown";
  throw new PlainError(PLAIN[code] ?? PLAIN[body.reason ?? ""] ?? "Something didn't go through. Your account is fine.", code);
}

export interface DraftQuestion {
  text: string;
  options: string[];
}

/** True once the relayer says it can draft questions; null while unknown. Cached per page load. */
let drafting: Promise<boolean> | null = null;
export function canDraft(): Promise<boolean> {
  drafting ??= fetch(`${RELAY_URL}/health`)
    .then((r) => r.json() as Promise<{ drafting?: boolean }>)
    .then((b) => !!b.drafting)
    .catch(() => false);
  return drafting;
}

const DRAFT_KEY = "kokonad.draftKey";

/**
 * The builder's own browser may carry a key that lifts the drafting limits on their own site.
 * Opening /host?draftkey=... once stores it; this is a testing convenience, never game state.
 */
export function rememberDraftKey(search: string): void {
  try {
    const key = new URLSearchParams(search).get("draftkey");
    if (key) localStorage.setItem(DRAFT_KEY, key);
  } catch {
    /* storage unavailable: limits simply apply */
  }
}
function draftKey(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

/** Asks for ready-to-edit questions about `topic`. Nothing is sealed; the host still decides. */
export async function draftQuestions(topic: string, count: number, language: string): Promise<DraftQuestion[]> {
  let res: Response;
  const key = draftKey();
  try {
    res = await fetch(`${RELAY_URL}/questions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { "x-draft-key": key } : {}) },
      body: JSON.stringify({ topic, count, language }),
    });
  } catch {
    throw new PlainError("Couldn't reach the question writer. Check your connection and try again.", "network");
  }
  const body = (await res.json().catch(() => ({}))) as { status?: string; questions?: DraftQuestion[]; reason?: string };
  if (body.status === "ok" && body.questions?.length) return body.questions;
  if (body.reason === "rate_limited") throw new PlainError("That's a lot of drafts in a row. Give it a few minutes.", "rate_limited");
  if (body.reason === "daily_cap") throw new PlainError("The question writer is resting for today. Write them yourself this time.", "daily_cap");
  throw new PlainError("Couldn't come up with questions just now. Try again, or write them yourself.", body.reason ?? "unknown");
}
