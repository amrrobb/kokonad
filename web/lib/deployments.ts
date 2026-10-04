import type { Address } from "viem";
import file from "../../deployments/10143.json";

/**
 * The only source of contract addresses (CLAUDE.md): deployments/10143.json at the repo root.
 * The end-to-end suite runs the same app against a local chain and passes that chain's addresses,
 * in the same shape, through NEXT_PUBLIC_DEPLOYMENTS_JSON (see web/e2e/stack.ts). Nothing else sets it.
 */
const override = process.env.NEXT_PUBLIC_DEPLOYMENTS_JSON;
const deployments = (override ? JSON.parse(override) : file) as typeof file;

export const contracts = deployments.contracts as {
  Forwarder: Address;
  KokoToken: Address;
  RoomFactory: Address;
};
export const CHAIN_ID = deployments.chainId;
/** Shared infrastructure on 10143 (not ours), recorded in the same file. */
export const multicall3 = deployments.infrastructure.Multicall3 as Address;
