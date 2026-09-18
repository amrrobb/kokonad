import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { roomAbi, roomFactoryAbi } from "./abi.js";

/** Everything the drip needs from the chain. Injected so the service can be unit-tested without one. */
export interface Chain {
  readonly operator: Address;
  getBalance(address: Address): Promise<bigint>;
  /** Room address for a join code, or null when the factory says the code does not exist. RPC failures throw. */
  resolveRoom(code: string): Promise<Address | null>;
  getParticipants(room: Address): Promise<Address[]>;
  /** Sends native value and resolves once the transfer is mined successfully. */
  sendValue(to: Address, wei: bigint): Promise<Hex>;
}

/**
 * Serializes sends so concurrent drips never race for a nonce. The next nonce is
 * max(fetched pending count, last used + 1): on a load-balanced RPC a node that has not yet
 * seen our previous transaction would otherwise hand back a nonce we already used.
 */
export class NonceQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastUsed: number | null = null;

  constructor(private readonly fetchPending: () => Promise<number>) {}

  run<T>(fn: (nonce: number) => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => {
      const fetched = await this.fetchPending();
      const nonce = this.lastUsed === null ? fetched : Math.max(fetched, this.lastUsed + 1);
      const result = await fn(nonce);
      this.lastUsed = nonce;
      return result;
    });
    // Keep the chain alive after a failure; the failed nonce is not marked used.
    this.tail = next.catch(() => undefined);
    return next;
  }
}

export class ViemChain implements Chain {
  readonly operator: Address;
  private readonly account: PrivateKeyAccount;
  private readonly pub: PublicClient;
  private readonly wallet: WalletClient;
  private readonly queue: NonceQueue;

  constructor(opts: { rpcUrl: string; chainId: number; operatorKey: Hex; factory: Address }) {
    const chain = defineChain({
      id: opts.chainId,
      name: `chain-${opts.chainId}`,
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [opts.rpcUrl] } },
    });
    this.account = privateKeyToAccount(opts.operatorKey);
    this.operator = this.account.address;
    this.pub = createPublicClient({ chain, transport: http(opts.rpcUrl) });
    this.wallet = createWalletClient({ chain, account: this.account, transport: http(opts.rpcUrl) });
    this.factory = opts.factory;
    this.queue = new NonceQueue(() =>
      this.pub.getTransactionCount({ address: this.operator, blockTag: "pending" }),
    );
  }

  private readonly factory: Address;

  getChainId(): Promise<number> {
    return this.pub.getChainId();
  }

  getBalance(address: Address): Promise<bigint> {
    return this.pub.getBalance({ address });
  }

  async resolveRoom(code: string): Promise<Address | null> {
    try {
      return await this.pub.readContract({
        address: this.factory,
        abi: roomFactoryAbi,
        functionName: "roomByCode",
        args: [code],
      });
    } catch (err) {
      // Only the contract's own "no such code" answer means absent. Anything else is a failed read.
      if (err instanceof BaseError) {
        const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName === "UnknownCode") return null;
      }
      throw err;
    }
  }

  async getParticipants(room: Address): Promise<Address[]> {
    return [...(await this.pub.readContract({ address: room, abi: roomAbi, functionName: "getParticipants" }))];
  }

  async sendValue(to: Address, wei: bigint): Promise<Hex> {
    const hash = await this.queue.run((nonce) =>
      this.wallet.sendTransaction({ account: this.account, chain: this.wallet.chain, to, value: wei, nonce }),
    );
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`transfer ${hash} reverted`);
    return hash;
  }
}
