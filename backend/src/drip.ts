import { getAddress, isAddress, type Address, type Hex } from "viem";
import type { Chain } from "./chain.js";
import type { DripConfig } from "./config.js";
import type { Ledger } from "./ledger.js";
import { decideDrip, planTopUps } from "./policy.js";
import { SlidingWindowLimiter } from "./rateLimit.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const CODE_RE = /^[A-Z2-9]{6}$/;

export type DripResult =
  | { status: "sent"; txHash: Hex; amountWei: bigint }
  | { status: "refused"; reason: "bad_address" | "bad_code" | "unknown_room" | "rate_limited" | "room_limit" | "already_dripped" | "daily_cap" | "in_flight" };

export type TopUpResult =
  | { status: "done"; sent: Array<{ address: Address; amountWei: bigint; txHash: Hex }>; skipped: Address[]; failed: Address[] }
  | { status: "refused"; reason: "bad_code" | "unknown_room" | "rate_limited" | "daily_cap" };

type Limits = Pick<
  DripConfig,
  "dripWei" | "topUpThresholdWei" | "topUpTargetWei" | "dailyCapWei" | "roomDripsPerHour" | "roomTopUpIntervalMs" | "addressRequestsPerMinute"
>;

export class DripService {
  private readonly inFlight = new Set<string>();
  private readonly addressLimiter: SlidingWindowLimiter;
  private readonly roomDripLimiter: SlidingWindowLimiter;
  private readonly roomTopUpLimiter: SlidingWindowLimiter;

  constructor(
    private readonly chain: Chain,
    private readonly ledger: Ledger,
    private readonly limits: Limits,
    private readonly now: () => number = Date.now,
  ) {
    this.addressLimiter = new SlidingWindowLimiter(limits.addressRequestsPerMinute, MINUTE_MS, now);
    this.roomDripLimiter = new SlidingWindowLimiter(limits.roomDripsPerHour, HOUR_MS, now);
    this.roomTopUpLimiter = new SlidingWindowLimiter(1, limits.roomTopUpIntervalMs, now);
  }

  /** One-time gas for a newly signed-in participant of an existing room. */
  async drip(rawAddress: string, rawCode: string): Promise<DripResult> {
    if (!isAddress(rawAddress)) return { status: "refused", reason: "bad_address" };
    const code = rawCode.toUpperCase();
    if (!CODE_RE.test(code)) return { status: "refused", reason: "bad_code" };
    const address = getAddress(rawAddress);
    const key = address.toLowerCase();

    if (!this.addressLimiter.tryTake(key)) return { status: "refused", reason: "rate_limited" };

    const decision = decideDrip({
      alreadyDripped: this.ledger.hasDripped(key),
      inFlight: this.inFlight.has(key),
      dripWei: this.limits.dripWei,
      sentLast24hWei: this.ledger.sentSince(this.now() - DAY_MS),
      dailyCapWei: this.limits.dailyCapWei,
    });
    if (!decision.ok) return { status: "refused", reason: decision.reason };

    this.inFlight.add(key);
    try {
      const room = await this.chain.resolveRoom(code);
      if (room === null) return { status: "refused", reason: "unknown_room" };
      if (!this.roomDripLimiter.tryTake(room.toLowerCase())) return { status: "refused", reason: "room_limit" };

      const txHash = await this.chain.sendValue(address, decision.amountWei);
      this.ledger.record({ address: key, kind: "drip", wei: decision.amountWei.toString(), txHash, room: room.toLowerCase(), at: this.now() });
      return { status: "sent", txHash, amountWei: decision.amountWei };
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Before a question opens: bring every participant below the threshold back up to the target. */
  async topUpRoom(rawCode: string): Promise<TopUpResult> {
    const code = rawCode.toUpperCase();
    if (!CODE_RE.test(code)) return { status: "refused", reason: "bad_code" };
    const room = await this.chain.resolveRoom(code);
    if (room === null) return { status: "refused", reason: "unknown_room" };
    if (!this.roomTopUpLimiter.tryTake(room.toLowerCase())) return { status: "refused", reason: "rate_limited" };

    const budgetWei = this.limits.dailyCapWei - this.ledger.sentSince(this.now() - DAY_MS);
    if (budgetWei <= 0n) return { status: "refused", reason: "daily_cap" };

    const participants = await this.chain.getActiveParticipants(room);
    const balances = await Promise.all(
      participants.map(async (address) => ({ address, balanceWei: await this.chain.getBalance(address) })),
    );
    const plan = planTopUps(balances, {
      thresholdWei: this.limits.topUpThresholdWei,
      targetWei: this.limits.topUpTargetWei,
      budgetWei,
    });

    const sent: Array<{ address: Address; amountWei: bigint; txHash: Hex }> = [];
    const failed: Address[] = [];
    for (const { address, amountWei } of plan.sends) {
      try {
        const txHash = await this.chain.sendValue(address as Address, amountWei);
        this.ledger.record({ address, kind: "topup", wei: amountWei.toString(), txHash, room: room.toLowerCase(), at: this.now() });
        sent.push({ address: address as Address, amountWei, txHash });
      } catch {
        failed.push(address as Address);
      }
    }
    return { status: "done", sent, skipped: plan.skipped as Address[], failed };
  }
}
