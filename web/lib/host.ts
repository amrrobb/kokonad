import { bytesToHex, decodeEventLog, encodeAbiParameters, encodeFunctionData, keccak256, numberToHex, parseEther, type Address, type Hex } from "viem";
import { factoryAbi, roomAbi, tokenAbi } from "./abi";
import { contracts } from "./deployments";
import { PlainError, send } from "./relay";
import { getSigner } from "./signer";

/**
 * Host actions. Same seam as players: the host's account signs, the relayer pays.
 * Sealed-but-unopened questions live in this tab's memory (text + options), and their salts also use
 * the salt fallback CLAUDE.md allows. Losing a salt makes that draft unopenable (HashMismatch), so it is
 * written down the moment the question is sealed, before the seal is sent.
 */
export interface Draft {
  id: bigint;
  text: string;
  options: string[];
  salt: Hex;
}
const drafts = new Map<string, Draft>(); // `${room}:${id}`

export function draft(room: Address, id: bigint): Draft | undefined {
  return drafts.get(`${room.toLowerCase()}:${id}`);
}

export async function createRoom(opts: { people: number; deposit: number; play: number }) {
  const me = getSigner()?.address;
  if (!me) throw new PlainError("Sign in first, then try again.", "signed_out");
  const cfg = { token: contracts.KokoToken, playPrice: parseEther(String(opts.play)), startingDeposit: parseEther(String(opts.deposit)), sponsored: true, hostPlays: false };
  const receipt = await send(contracts.RoomFactory, encodeFunctionData({ abi: factoryAbi, functionName: "createRoom", args: [cfg] }), 6_000_000n);
  const ev = receipt.logs
    .map((l) => { try { return decodeEventLog({ abi: factoryAbi, data: l.data, topics: l.topics }); } catch { return null; } })
    .find((e) => e?.eventName === "RoomCreated");
  if (!ev) throw new Error("room not created");
  const { room, code } = ev.args as { room: Address; code: string };
  // Sponsored: the host's budget pays every participant's starting deposit.
  const budget = parseEther(String(opts.people * opts.deposit));
  await send(contracts.KokoToken, encodeFunctionData({ abi: tokenAbi, functionName: "mint", args: [me, budget] }));
  await send(contracts.KokoToken, encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [room, budget] }));
  await send(room, encodeFunctionData({ abi: roomAbi, functionName: "fundBudget", args: [budget] }));
  return { room, code };
}

/**
 * Seals a whole list of questions in one request. Ids come from the contract's QuestionCommitted
 * events, never from a (possibly stale) poll. Each salt is written down before anything is sent:
 * without it that question can never be opened.
 */
export async function sealQuestions(room: Address, items: Array<{ text: string; options: string[] }>): Promise<Draft[]> {
  const prepared = items.map(({ text, options }) => {
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    const hash = keccak256(encodeAbiParameters(
      [{ type: "string" }, { type: "string[]" }, { type: "uint8" }, { type: "uint8" }, { type: "uint8" }, { type: "bytes32" }],
      [text, options, 0, 0, 0, salt],
    ));
    try {
      localStorage.setItem(`kokonad:hostsalt:${hash}`, salt);
    } catch {
      /* memory only */
    }
    return { text, options, salt, hash };
  });
  const receipt = await send(room, encodeFunctionData({ abi: roomAbi, functionName: "commitQuestions", args: [prepared.map((q) => q.hash)] }), 200_000n + 120_000n * BigInt(prepared.length));
  const idByHash = new Map<string, bigint>();
  for (const l of receipt.logs) {
    try {
      const e = decodeEventLog({ abi: roomAbi, data: l.data, topics: l.topics });
      if (e.eventName === "QuestionCommitted") idByHash.set((e.args as { commitHash: Hex }).commitHash.toLowerCase(), (e.args as { id: bigint }).id);
    } catch {
      /* another contract's log */
    }
  }
  return prepared.map((q) => {
    const id = idByHash.get(q.hash.toLowerCase());
    if (id === undefined) throw new Error("question not sealed");
    const d: Draft = { id, text: q.text, options: q.options, salt: q.salt };
    drafts.set(`${room.toLowerCase()}:${id}`, d);
    return d;
  });
}

export async function openQuestion(room: Address, d: Draft, timer: number) {
  await send(room, encodeFunctionData({ abi: roomAbi, functionName: "openQuestion", args: [d.id, d.text, d.options, 0, 0, 0, d.salt, 0n, timer] }), 3_000_000n);
}

export async function resolveQuestion(room: Address, id: bigint, option: number) {
  await send(room, encodeFunctionData({ abi: roomAbi, functionName: "resolve", args: [id, numberToHex(BigInt(option), { size: 32 })] }), 2_000_000n);
}

/**
 * The dispute window closes on the chain's clock, not this laptop's. The newest block is always a
 * moment behind the wall clock (and a laptop clock can be off by seconds), so the first try right at
 * the deadline can still be refused. That is "not yet", not a failure: wait a second and try again.
 */
export async function settleQuestion(room: Address, id: bigint) {
  const data = encodeFunctionData({ abi: roomAbi, functionName: "settle", args: [id] });
  for (let attempt = 0; ; attempt++) {
    try {
      await send(room, data, 2_000_000n);
      return;
    } catch (err) {
      if (!(err instanceof PlainError) || err.code !== "DisputeWindowOpen" || attempt >= 8) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
