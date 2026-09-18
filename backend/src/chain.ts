import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  defineChain,
  http,
  maxUint256,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { forwarderAbi, roomAbi, roomFactoryAbi } from "./abi.js";

/** A signed ERC-2771 request, as the forwarder takes it. */
export interface ForwardRequest {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  deadline: number;
  data: Hex;
  signature: Hex;
}

export type Simulation = { ok: true } | { ok: false; reason: string };

/** Everything the relay needs from the chain. Injected so the service can be unit-tested without one. */
export interface Chain {
  readonly operator: Address;
  readonly token: Address;
  readonly factory: Address;
  /** True only when the factory's own registry maps this room's code back to this exact address. */
  isFactoryRoom(address: Address): Promise<boolean>;
  /** Forwarder-level check: signature, nonce and deadline. */
  verify(req: ForwardRequest): Promise<boolean>;
  /** Runs the inner call as the signer (balance overridden, since a fresh player holds none). */
  simulate(req: ForwardRequest): Promise<Simulation>;
  /** Submits forwarder.execute and resolves once mined successfully, with the gas actually charged. */
  execute(req: ForwardRequest): Promise<{ txHash: Hex; costWei: bigint }>;
}

/**
 * Serializes sends so concurrent relays never race for a nonce. The next nonce is
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

/** Best-effort name for a revert, from Room/ERC-20/forwarder errors. */
export function revertReason(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) return revert.data.errorName;
    const raw = (err.walk((e) => typeof (e as { data?: unknown }).data === "string") as { data?: Hex } | null)?.data;
    if (raw) {
      for (const abi of [roomAbi, forwarderAbi, roomFactoryAbi]) {
        try {
          return decodeErrorResult({ abi, data: raw }).errorName;
        } catch {
          /* try next */
        }
      }
    }
    return err.shortMessage;
  }
  return String(err);
}

export class ViemChain implements Chain {
  readonly operator: Address;
  readonly token: Address;
  readonly factory: Address;
  private readonly forwarder: Address;
  private readonly account: PrivateKeyAccount;
  private readonly pub: PublicClient;
  private readonly wallet: WalletClient;
  private readonly queue: NonceQueue;

  constructor(opts: {
    rpcUrl: string;
    chainId: number;
    operatorKey: Hex;
    contracts: { RoomFactory: Address; KokoToken: Address; Forwarder: Address };
  }) {
    const chain = defineChain({
      id: opts.chainId,
      name: `chain-${opts.chainId}`,
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [opts.rpcUrl] } },
    });
    this.account = privateKeyToAccount(opts.operatorKey);
    this.operator = this.account.address;
    this.token = opts.contracts.KokoToken;
    this.factory = opts.contracts.RoomFactory;
    this.forwarder = opts.contracts.Forwarder;
    this.pub = createPublicClient({ chain, transport: http(opts.rpcUrl) });
    this.wallet = createWalletClient({ chain, account: this.account, transport: http(opts.rpcUrl) });
    this.queue = new NonceQueue(() => this.pub.getTransactionCount({ address: this.operator, blockTag: "pending" }));
  }

  getChainId(): Promise<number> {
    return this.pub.getChainId();
  }

  getOperatorBalance(): Promise<bigint> {
    return this.pub.getBalance({ address: this.operator });
  }

  async isFactoryRoom(address: Address): Promise<boolean> {
    let code: string;
    try {
      code = await this.pub.readContract({ address, abi: roomAbi, functionName: "code" });
    } catch (err) {
      // Not a contract with a code() getter: definitely not one of ours. RPC failures still throw.
      if (err instanceof BaseError && err.walk((e) => e instanceof ContractFunctionRevertedError)) return false;
      if (err instanceof BaseError && /returned no data|reverted/i.test(err.shortMessage)) return false;
      throw err;
    }
    try {
      const room = await this.pub.readContract({ address: this.factory, abi: roomFactoryAbi, functionName: "roomByCode", args: [code] });
      return room.toLowerCase() === address.toLowerCase();
    } catch (err) {
      if (revertReason(err) === "UnknownCode") return false;
      throw err;
    }
  }

  verify(req: ForwardRequest): Promise<boolean> {
    return this.pub.readContract({ address: this.forwarder, abi: forwarderAbi, functionName: "verify", args: [toTuple(req)] });
  }

  async simulate(req: ForwardRequest): Promise<Simulation> {
    try {
      // Called directly as the signer: the target sees msg.sender == signer, same as a relayed call.
      await this.pub.call({
        account: req.from,
        to: req.to,
        data: req.data,
        gas: req.gas,
        stateOverride: [{ address: req.from, balance: maxUint256 / 2n }],
      });
      return { ok: true };
    } catch (err) {
      const reason = revertReason(err);
      if (err instanceof BaseError && /revert/i.test(err.message)) return { ok: false, reason };
      throw err; // RPC failure: not a verdict on the request
    }
  }

  async execute(req: ForwardRequest): Promise<{ txHash: Hex; costWei: bigint }> {
    const args = [toTuple(req)] as const;
    const estimate = await this.pub.estimateContractGas({ account: this.account, address: this.forwarder, abi: forwarderAbi, functionName: "execute", args });
    // Monad charges the full gas limit, so keep the buffer small.
    const gas = (estimate * 110n) / 100n;
    const hash = await this.queue.run((nonce) =>
      this.wallet.writeContract({ account: this.account, chain: this.wallet.chain, address: this.forwarder, abi: forwarderAbi, functionName: "execute", args, gas, nonce }),
    );
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`relay ${hash} reverted`);
    return { txHash: hash, costWei: gas * receipt.effectiveGasPrice };
  }
}

function toTuple(req: ForwardRequest) {
  return { from: req.from, to: req.to, value: req.value, gas: req.gas, deadline: req.deadline, data: req.data, signature: req.signature };
}
