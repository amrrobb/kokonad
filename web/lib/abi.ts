import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "function roomByCode(string code) view returns (address room)",
  "function createRoom((address token, uint128 playPrice, uint128 startingDeposit, bool sponsored, bool hostPlays) cfg) returns (address room, string code)",
  "event RoomCreated(address indexed room, address indexed host, string code, address token, uint128 playPrice, uint128 startingDeposit, bool sponsored, bool hostPlays)",
  "error UnknownCode()",
]);

export const forwarderAbi = parseAbi(["function nonces(address owner) view returns (uint256)"]);

export const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
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
  "function questionCount() view returns (uint256)",
  "function phase(uint256 id) view returns (uint8)",
  "function getQuestion(uint256 id) view returns ((bytes32 commitHash, string text, string[] options, uint8 template, uint8 rule, uint8 n, uint128 hostSeed, uint128 pot, uint32 charged, uint64 openAt, uint64 lockAt, uint64 revealUntil, uint64 disputeUntil, uint8 status, bytes32 outcome, address resolver, uint32 answerers, uint32 revealed, uint32 disputes))",
  "function getAnswer(uint256 id, address participant) view returns ((bytes32 commitHash, bytes32 answer, uint64 revealBlock, uint32 revealIndex, bool revealed, bool claimed))",
  "function getWinners(uint256 id) view returns (address[])",
  "function getRevealers(uint256 id) view returns (address[])",
  "function hasAnswerToken(uint256, address) view returns (bool)",
  "function hasCorrectToken(uint256, address) view returns (bool)",
  "function wasCharged(uint256, address) view returns (bool)",
  "function commitAnswer(uint256 id, bytes32 commitHash)",
  "function revealAnswer(uint256 id, bytes32 answer, bytes32 salt)",
  "function fundBudget(uint128 amount)",
  "function commitQuestions(bytes32[] hashes)",
  "function openQuestion(uint256 id, string text, string[] options, uint8 template, uint8 rule, uint8 n, bytes32 hostSalt, uint128 seed, uint32 timer)",
  "function resolve(uint256 id, bytes32 outcome)",
  "function settle(uint256 id)",
  "function REVEAL_WINDOW() view returns (uint64)",
  "event QuestionCommitted(uint256 indexed id, bytes32 commitHash)",
]);

/** Room.Status, in contract order. */
export const Status = { DRAFT: 0, OPEN: 1, LOCKED: 2, REVEAL: 3, RESOLVED: 4, SETTLED: 5, VOIDED: 6 } as const;
