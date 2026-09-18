import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import type { Chain, ForwardRequest } from "./chain.js";
import type { RelayConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import { SlidingWindowLimiter } from "./rateLimit.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_DATA_BYTES = 8 * 1024;
const MAX_DEADLINE_AHEAD_S = 24 * 60 * 60;

export type RelayResult =
  | { status: "relayed"; txHash: Hex }
  | { status: "refused"; reason: RefusalReason; detail?: string };

export type RefusalReason =
  | "bad_request"
  | "value_not_allowed"
  | "gas_too_high"
  | "deadline"
  | "target_not_allowed"
  | "bad_signature"
  | "call_would_revert"
  | "rate_limited"
  | "daily_cap";

type Limits = Pick<RelayConfig, "dailyCapWei" | "maxRequestGas" | "signerRequestsPerMinute">;

/**
 * Pays gas for players. It never decides anything about money or results: it only submits requests the
 * player signed, to Kokonad's own contracts, and only after the forwarder accepts the signature and a
 * dry run shows the call would succeed. It can delay a request; it cannot forge or alter one.
 */
export class RelayService {
  private readonly signerLimiter: SlidingWindowLimiter;

  constructor(
    private readonly chain: Chain,
    private readonly ledger: Ledger,
    private readonly limits: Limits,
    private readonly now: () => number = Date.now,
  ) {
    this.signerLimiter = new SlidingWindowLimiter(limits.signerRequestsPerMinute, MINUTE_MS, now);
  }

  /** Parses untrusted JSON into a request, or explains what is wrong with it. */
  static parse(body: unknown): ForwardRequest | { error: string } {
    const r = (body as { request?: Record<string, unknown> } | null)?.request;
    if (!r || typeof r !== "object") return { error: "missing request" };
    const { from, to, value, gas, deadline, data, signature } = r;
    if (typeof from !== "string" || !isAddress(from)) return { error: "from" };
    if (typeof to !== "string" || !isAddress(to)) return { error: "to" };
    if (typeof data !== "string" || !isHex(data)) return { error: "data" };
    if (typeof signature !== "string" || !isHex(signature) || signature.length !== 132) return { error: "signature" };
    const int = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v)) || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
    if (!int(value) || !int(gas) || !int(deadline)) return { error: "value/gas/deadline must be non-negative integers" };
    return {
      from: getAddress(from),
      to: getAddress(to),
      value: BigInt(value as string | number),
      gas: BigInt(gas as string | number),
      deadline: Number(deadline),
      data: data as Hex,
      signature: signature as Hex,
    };
  }

  private async targetAllowed(to: Address): Promise<boolean> {
    const t = to.toLowerCase();
    if (t === this.chain.token.toLowerCase() || t === this.chain.factory.toLowerCase()) return true;
    return this.chain.isFactoryRoom(to);
  }

  async relay(req: ForwardRequest): Promise<RelayResult> {
    // Cheap, local checks first.
    if (req.value !== 0n) return { status: "refused", reason: "value_not_allowed" };
    if (req.gas === 0n || req.gas > this.limits.maxRequestGas) return { status: "refused", reason: "gas_too_high" };
    if ((req.data.length - 2) / 2 > MAX_DATA_BYTES) return { status: "refused", reason: "bad_request", detail: "data too large" };
    const nowS = Math.floor(this.now() / 1000);
    if (req.deadline <= nowS || req.deadline > nowS + MAX_DEADLINE_AHEAD_S) return { status: "refused", reason: "deadline" };
    if (!this.signerLimiter.tryTake(req.from.toLowerCase())) return { status: "refused", reason: "rate_limited" };
    if (this.ledger.spentSince(this.now() - DAY_MS) >= this.limits.dailyCapWei) return { status: "refused", reason: "daily_cap" };

    // Chain checks. RPC failures throw and surface as 502, never as a verdict on the request.
    if (!(await this.targetAllowed(req.to))) return { status: "refused", reason: "target_not_allowed" };
    if (!(await this.chain.verify(req))) return { status: "refused", reason: "bad_signature" };
    const sim = await this.chain.simulate(req);
    if (!sim.ok) return { status: "refused", reason: "call_would_revert", detail: sim.reason };

    const { txHash, costWei } = await this.chain.execute(req);
    this.ledger.record({ signer: req.from, target: req.to, wei: costWei.toString(), txHash, at: this.now() });
    return { status: "relayed", txHash };
  }
}
