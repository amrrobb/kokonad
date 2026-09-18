import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "function roomByCode(string code) view returns (address room)",
  "error UnknownCode()",
]);

export const forwarderAbi = parseAbi(["function nonces(address owner) view returns (uint256)"]);

export const tokenAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const roomAbi = parseAbi([
  "function code() view returns (string)",
  "function host() view returns (address)",
  "function sponsored() view returns (bool)",
  "function startingDeposit() view returns (uint128)",
  "function playPrice() view returns (uint128)",
  "function budget() view returns (uint128)",
  "function closed() view returns (bool)",
  "function joined(address) view returns (bool)",
  "function participants(address) view returns (uint128 deposit, bool left, uint32 correctTotal)",
  "function displayNames(address) view returns (string)",
  "function getParticipants() view returns (address[])",
  "function join(string code, string displayName)",
]);
