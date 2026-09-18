import { BaseError, ContractFunctionRevertedError, createPublicClient, http, type Address } from "viem";
import { factoryAbi, roomAbi, Status, tokenAbi } from "./abi";
import { monadTestnet } from "./chain";
import { contracts, multicall3 } from "./deployments";

/**
 * Every read of one poll is folded into a single Multicall3 eth_call. Two browsers polling a dozen
 * separate reads every 2 s already drew HTTP 429s from the RPC provider on 18 Sep.
 */
export const publicClient = createPublicClient({
  chain: { ...monadTestnet, contracts: { multicall3: { address: multicall3 } } },
  transport: http(),
  batch: { multicall: { wait: 16 } },
});

/**
 * Runs every read of one screen at a single block. On a load-balanced RPC, separate "latest" reads can
 * land on nodes at different heights: a node that has seen resolve() says RESOLVED while another still
 * returns the old zero outcome, and the screen told a loser the wrong answer was right. Pinning the
 * block makes one poll one consistent snapshot; a node that has not reached it yet errors and we retry.
 */
async function atOneBlock<T>(fn: (blockNumber: bigint) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
    try {
      return await fn(blockNumber);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw lastErr;
}

/** Room address for a code, or null when the factory says it does not exist. Network failures throw. */
export async function findRoom(code: string): Promise<Address | null> {
  try {
    return await publicClient.readContract({ address: contracts.RoomFactory, abi: factoryAbi, functionName: "roomByCode", args: [code] });
  } catch (err) {
    if (err instanceof BaseError) {
      const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName === "UnknownCode") return null;
    }
    throw err;
  }
}

export interface RoomView {
  address: Address;
  host: Address;
  sponsored: boolean;
  startingDeposit: bigint;
  playPrice: bigint;
  closed: boolean;
  /** deposit: coins still in the room; held: coins paid out to the account. Same block. */
  me: { joined: boolean; deposit: bigint; held: bigint };
  people: Array<{ address: Address; name: string }>;
}

export async function readRoom(address: Address, me: Address): Promise<RoomView> {
  return atOneBlock((blockNumber) => readRoomAt(address, me, blockNumber));
}

async function readRoomAt(address: Address, me: Address, blockNumber: bigint): Promise<RoomView> {
  const r = (fn: string, args: readonly unknown[] = []) =>
    publicClient.readContract({ address, abi: roomAbi, functionName: fn as never, args: args as never, blockNumber });
  const coinsHeld = publicClient.readContract({ address: contracts.KokoToken, abi: tokenAbi, functionName: "balanceOf", args: [me], blockNumber });
  const [host, sponsored, startingDeposit, playPrice, closed, joined, mine, list] = await Promise.all([
    r("host"), r("sponsored"), r("startingDeposit"), r("playPrice"), r("closed"), r("joined", [me]), r("participants", [me]), r("getParticipants"),
  ]);
  const addresses = list as Address[];
  const names = await Promise.all(addresses.map((a) => r("displayNames", [a]) as Promise<string>));
  return {
    address,
    host: host as Address,
    sponsored: sponsored as boolean,
    startingDeposit: startingDeposit as bigint,
    playPrice: playPrice as bigint,
    closed: closed as boolean,
    me: { joined: joined as boolean, deposit: (mine as readonly [bigint, boolean, number])[0], held: await coinsHeld },
    people: addresses.map((a, i) => ({ address: a, name: names[i] ?? "" })),
  };
}

export interface QuestionView {
  id: bigint;
  text: string;
  options: string[];
  status: number; // effective, from phase()
  pot: bigint;
  charged: number;
  lockAt: number;
  disputeUntil: number;
  outcome: bigint;
  answerers: number;
  revealed: number;
  me: { charged: boolean; hasPlay: boolean; committed: boolean; revealed: boolean; answer: bigint; correct: boolean };
  winners: number;
}

/** The latest question the host has opened, from the chain; null while every question is still a sealed draft. */
export async function readLatestQuestion(address: Address, me: Address): Promise<QuestionView | null> {
  return atOneBlock((blockNumber) => readLatestQuestionAt(address, me, blockNumber));
}

async function readLatestQuestionAt(address: Address, me: Address, blockNumber: bigint): Promise<QuestionView | null> {
  const r = (fn: string, args: readonly unknown[] = []) =>
    publicClient.readContract({ address, abi: roomAbi, functionName: fn as never, args: args as never, blockNumber });
  const count = (await r("questionCount")) as bigint;
  for (let id = count - 1n; id >= 0n; id--) {
    const q = (await r("getQuestion", [id])) as {
      text: string; options: readonly string[]; pot: bigint; charged: number; lockAt: bigint; disputeUntil: bigint;
      status: number; outcome: `0x${string}`; answerers: number; revealed: number;
    };
    if (q.status === 0) continue; // DRAFT: sealed, not opened yet
    const [a, hasPlay, charged, correct, winners] = await Promise.all([
      r("getAnswer", [id, me]), r("hasAnswerToken", [id, me]), r("wasCharged", [id, me]),
      r("hasCorrectToken", [id, me]), r("getWinners", [id]),
    ]);
    // Same rule as Room.phase(), applied to this snapshot rather than a separate call.
    const phase = q.status === Status.OPEN && Math.floor(Date.now() / 1000) >= Number(q.lockAt) ? Status.LOCKED : q.status;
    const ans = a as { commitHash: `0x${string}`; answer: `0x${string}`; revealed: boolean };
    return {
      id,
      text: q.text,
      options: [...q.options],
      status: phase as number,
      pot: q.pot,
      charged: q.charged,
      lockAt: Number(q.lockAt),
      disputeUntil: Number(q.disputeUntil),
      outcome: BigInt(q.outcome),
      answerers: q.answerers,
      revealed: q.revealed,
      me: {
        charged: charged as boolean,
        hasPlay: hasPlay as boolean,
        committed: BigInt(ans.commitHash) !== 0n,
        revealed: ans.revealed,
        answer: BigInt(ans.answer),
        correct: correct as boolean,
      },
      winners: (winners as readonly Address[]).length,
    };
  }
  return null;
}

