import { bytesToHex, decodeEventLog, encodeAbiParameters, encodeFunctionData, keccak256, numberToHex, parseEther, type Address, type Hex } from "viem";
import { factoryAbi, roomAbi, tokenAbi } from "./abi";
import { contracts } from "./deployments";
import { PlainError, send } from "./relay";
import { getAccount } from "./signer";

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
  const me = getAccount().address;
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

/** Seals one question. The id comes from the contract's QuestionCommitted event, never from a (possibly stale) poll. */
export async function sealQuestion(room: Address, text: string, options: string[]) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash = keccak256(encodeAbiParameters(
    [{ type: "string" }, { type: "string[]" }, { type: "uint8" }, { type: "uint8" }, { type: "uint8" }, { type: "bytes32" }],
    [text, options, 0, 0, 0, salt],
  ));
  // Written down before sending: without the salt this question can never be opened.
  try {
    localStorage.setItem(`kokonad:hostsalt:${hash}`, salt);
  } catch {
    /* memory only */
  }
  const receipt = await send(room, encodeFunctionData({ abi: roomAbi, functionName: "commitQuestions", args: [[hash]] }));
  const ev = receipt.logs
    .map((l) => { try { return decodeEventLog({ abi: roomAbi, data: l.data, topics: l.topics }); } catch { return null; } })
    .find((e) => e?.eventName === "QuestionCommitted");
  if (!ev) throw new Error("question not sealed");
  const id = (ev.args as { id: bigint }).id;
  const d: Draft = { id, text, options, salt };
  drafts.set(`${room.toLowerCase()}:${id}`, d);
  return d;
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
