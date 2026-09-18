import type { Address } from "viem";
import deployments from "../../deployments/10143.json";

/** The only source of contract addresses (CLAUDE.md): deployments/10143.json at the repo root. */
export const contracts = deployments.contracts as {
  Forwarder: Address;
  KokoToken: Address;
  RoomFactory: Address;
};
export const CHAIN_ID = deployments.chainId;
