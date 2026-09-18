import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, parseEther, zeroAddress, type Address, type Hex } from "viem";

/** Mainnet chain IDs the drip must never run against (testnet only, CLAUDE.md #6). */
export const FORBIDDEN_CHAIN_IDS = new Set([143]);

export interface Deployments {
  chainId: number;
  contracts: { RoomFactory: Address; KokoToken: Address; Forwarder: Address };
}

export interface RelayConfig {
  rpcUrl: string;
  operatorKey: Hex;
  deployments: Deployments;
  ledgerPath: string;
  port: number;
  /** Hard ceiling on MON the relayer spends on gas per rolling 24 h. */
  dailyCapWei: bigint;
  /** Largest gas a single signed request may ask the forwarder to pass on (creating a room is the heaviest call). */
  maxRequestGas: bigint;
  /** Relayed requests per signer per minute. */
  signerRequestsPerMinute: number;
  /** Relayed KokoToken calls (open mint) per signer per hour, and across all signers per hour. */
  tokenCallsPerSignerPerHour: number;
  tokenCallsPerHour: number;
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
  const forwarder = raw.contracts?.Forwarder;
  for (const [name, value] of [["RoomFactory", factory], ["KokoToken", token], ["Forwarder", forwarder]] as const) {
    if (typeof value !== "string" || !isAddress(value)) throw new Error(`${path}: ${name} is not an address`);
  }
  return {
    chainId,
    contracts: { RoomFactory: factory as Address, KokoToken: token as Address, Forwarder: forwarder as Address },
  };
}

/** True when the deployments file still holds the pre-deploy placeholder. */
export function isPlaceholder(d: Deployments): boolean {
  return Object.values(d.contracts).some((a) => a.toLowerCase() === zeroAddress);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`missing env var ${name} (see backend/.env.example)`);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  const operatorKey = required(env, "RELAYER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(operatorKey)) throw new Error("RELAYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key");
  const deployments = loadDeployments(env.DEPLOYMENTS_PATH ?? DEFAULT_DEPLOYMENTS_PATH);
  if (isPlaceholder(deployments)) {
    throw new Error("deployments file still has placeholder addresses; deploy contracts first");
  }
  return {
    rpcUrl: required(env, "RPC_URL"),
    operatorKey: operatorKey as Hex,
    deployments,
    ledgerPath: env.RELAY_LEDGER_PATH ?? resolve(here, "../.data/relay-ledger.json"),
    port: Number(env.PORT ?? 8787),
    dailyCapWei: parseEther(env.DAILY_CAP_MON ?? "5"),
    maxRequestGas: BigInt(env.MAX_REQUEST_GAS ?? "8000000"),
    signerRequestsPerMinute: Number(env.SIGNER_REQUESTS_PER_MINUTE ?? 30),
    tokenCallsPerSignerPerHour: Number(env.TOKEN_CALLS_PER_SIGNER_PER_HOUR ?? 4),
    tokenCallsPerHour: Number(env.TOKEN_CALLS_PER_HOUR ?? 30),
  };
}
