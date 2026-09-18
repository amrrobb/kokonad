import { BaseError, ContractFunctionRevertedError, createPublicClient, http, type Address } from "viem";
import { factoryAbi, roomAbi } from "./abi";
import { monadTestnet } from "./chain";
import { contracts } from "./deployments";

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

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
  closed: boolean;
  me: { joined: boolean; deposit: bigint };
  people: Array<{ address: Address; name: string }>;
}

export async function readRoom(address: Address, me: Address): Promise<RoomView> {
  const r = (fn: string, args: readonly unknown[] = []) =>
    publicClient.readContract({ address, abi: roomAbi, functionName: fn as never, args: args as never });
  const [host, sponsored, startingDeposit, closed, joined, mine, list] = await Promise.all([
    r("host"), r("sponsored"), r("startingDeposit"), r("closed"), r("joined", [me]), r("participants", [me]), r("getParticipants"),
  ]);
  const addresses = list as Address[];
  const names = await Promise.all(addresses.map((a) => r("displayNames", [a]) as Promise<string>));
  return {
    address,
    host: host as Address,
    sponsored: sponsored as boolean,
    startingDeposit: startingDeposit as bigint,
    closed: closed as boolean,
    me: { joined: joined as boolean, deposit: (mine as readonly [bigint, boolean, number])[0] },
    people: addresses.map((a, i) => ({ address: a, name: names[i] ?? "" })),
  };
}
