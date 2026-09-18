import type { Address, Hex, LocalAccount } from "viem";

/** EIP-712 types of OpenZeppelin's ERC2771Forwarder (deployed with name "Kokonad", version "1"). */
export const forwardRequestTypes = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

/**
 * Signs a request for the relayer. The player's account only signs; it never sends a transaction,
 * so it needs no MON. Returns the JSON body POST /relay expects (integers as decimal strings).
 */
export async function signForwardRequest(opts: {
  account: LocalAccount;
  forwarder: Address;
  chainId: number;
  to: Address;
  data: Hex;
  nonce: bigint;
  gas?: bigint;
  deadline: number;
}) {
  const gas = opts.gas ?? 500_000n;
  const message = { from: opts.account.address, to: opts.to, value: 0n, gas, nonce: opts.nonce, deadline: opts.deadline, data: opts.data };
  const signature = await opts.account.signTypedData({
    domain: { name: "Kokonad", version: "1", chainId: opts.chainId, verifyingContract: opts.forwarder },
    types: forwardRequestTypes,
    primaryType: "ForwardRequest",
    message,
  });
  return {
    request: {
      from: opts.account.address,
      to: opts.to,
      value: "0",
      gas: gas.toString(),
      deadline: opts.deadline,
      data: opts.data,
      signature,
    },
  };
}
