import { parseAbi } from "viem";

const REQUEST = "(address from,address to,uint256 value,uint256 gas,uint48 deadline,bytes data,bytes signature)";

/** OpenZeppelin ERC2771Forwarder, only what the relayer calls. */
export const forwarderAbi = parseAbi([
  `function verify(${REQUEST} request) view returns (bool)`,
  `function execute(${REQUEST} request) payable`,
  "function nonces(address owner) view returns (uint256)",
  "error ERC2771ForwarderInvalidSigner(address signer, address from)",
  "error ERC2771ForwarderExpiredRequest(uint48 deadline)",
  "error ERC2771UntrustfulTarget(address target, address forwarder)",
  "error FailedCall()",
]);

export const roomFactoryAbi = parseAbi([
  "function roomByCode(string code) view returns (address room)",
  "error UnknownCode()",
]);

/** Room's public code getter plus every custom error, so a refused request says why. */
export const roomAbi = parseAbi([
  "function code() view returns (string)",
  ...[
    "NotHost", "NotResolver", "NotParticipant", "RoomIsClosed", "WrongCode", "HostCannotJoin", "AlreadyJoined",
    "RoomFull", "InsufficientBudget", "ZeroAmount", "PooledOnly", "SponsoredOnly", "TooManyQuestions", "BadQuestion",
    "WrongStatus", "HashMismatch", "NoAnswerToken", "TooLate", "TooEarly", "AlreadyRevealed", "NotAnswerer",
    "AlreadyDisputed", "QuestionInFlight", "NothingToClaim", "BadOutcome", "DisputeWindowOpen", "SessionKeyTaken",
  ].map((e) => `error ${e}()`),
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error SafeERC20FailedOperation(address token)",
]);
