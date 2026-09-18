import { parseAbi } from "viem";

/** Only what the drip reads. The integration test runs these against the real compiled contracts. */
export const roomFactoryAbi = parseAbi([
  "function roomByCode(string code) view returns (address room)",
  "error UnknownCode()",
]);

export const roomAbi = parseAbi([
  "function getParticipants() view returns (address[])",
  "function participants(address) view returns (uint128 deposit, bool left, uint32 correctTotal)",
]);
