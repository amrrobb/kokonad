import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, parseEther, zeroAddress, type Address, type Hex } from "viem";

/** Mainnet chain IDs the drip must never run against (testnet only, CLAUDE.md #6). */
export const FORBIDDEN_CHAIN_IDS = new Set([143]);

export interface Deployments {
  chainId: number;
  contracts: { RoomFactory: Address; KokoToken: Address };
}

export interface DripConfig {
  rpcUrl: string;
  operatorKey: Hex;
  deployments: Deployments;
  ledgerPath: string;
  port: number;
  /** Sent once per address on first sign-in. */
  dripWei: bigint;
  /** Participants below this get topped up before a question opens. */
  topUpThresholdWei: bigint;
  /** Top-ups bring the balance back to this level. */
  topUpTargetWei: bigint;
  /** Hard ceiling on MON sent per rolling 24 h, across all rooms. */
  dailyCapWei: bigint;
  /** Max first-time drips per room per hour (a room holds at most 50 participants). */
  roomDripsPerHour: number;
  /** Min gap between two top-up rounds for the same room. */
  roomTopUpIntervalMs: number;
  /** Max drip requests per address per minute (answers repeat clicks, not repeat drips). */
  addressRequestsPerMinute: number;
}

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DEPLOYMENTS_PATH = resolve(here, "../../deployments/10143.json");

/** Reads and validates a deployments file. Throws on anything that is not usable. */
export function loadDeployments(path: string): Deployments {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<{
    chainId: unknown;
    contracts: Record<string, unknown>;
  }>;
  const chainId = raw.chainId;
  if (typeof chainId !== "number" || !Number.isInteger(chainId)) {
    throw new Error(`${path}: chainId missing or not an integer`);
  }
  if (FORBIDDEN_CHAIN_IDS.has(chainId)) throw new Error(`${path}: chain ${chainId} is mainnet; testnet only`);
  const factory = raw.contracts?.RoomFactory;
  const token = raw.contracts?.KokoToken;
  for (const [name, value] of [["RoomFactory", factory], ["KokoToken", token]] as const) {
    if (typeof value !== "string" || !isAddress(value)) throw new Error(`${path}: ${name} is not an address`);
  }
  return { chainId, contracts: { RoomFactory: factory as Address, KokoToken: token as Address } };
}

/** True when the deployments file still holds the pre-deploy placeholder. */
export function isPlaceholder(d: Deployments): boolean {
  return d.contracts.RoomFactory.toLowerCase() === zeroAddress;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`missing env var ${name} (see backend/.env.example)`);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DripConfig {
  const operatorKey = required(env, "DRIP_OPERATOR_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(operatorKey)) throw new Error("DRIP_OPERATOR_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key");
  const deployments = loadDeployments(env.DEPLOYMENTS_PATH ?? DEFAULT_DEPLOYMENTS_PATH);
  if (isPlaceholder(deployments)) {
    throw new Error("deployments file still has placeholder addresses; deploy contracts first");
  }
  return {
    rpcUrl: required(env, "RPC_URL"),
    operatorKey: operatorKey as Hex,
    deployments,
    ledgerPath: env.DRIP_LEDGER_PATH ?? resolve(here, "../.data/drip-ledger.json"),
    port: Number(env.PORT ?? 8787),
    dripWei: parseEther(env.DRIP_AMOUNT_MON ?? "0.1"),
    topUpThresholdWei: parseEther(env.TOPUP_THRESHOLD_MON ?? "0.02"),
    topUpTargetWei: parseEther(env.TOPUP_TARGET_MON ?? "0.1"),
    dailyCapWei: parseEther(env.DAILY_CAP_MON ?? "5"),
    roomDripsPerHour: Number(env.ROOM_DRIPS_PER_HOUR ?? 60),
    roomTopUpIntervalMs: Number(env.ROOM_TOPUP_INTERVAL_MS ?? 10_000),
    addressRequestsPerMinute: Number(env.ADDRESS_REQUESTS_PER_MINUTE ?? 5),
  };
}
