import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { decideDrip, planTopUps, topUpAmount } from "../../src/policy.js";

const base = { alreadyDripped: false, inFlight: false, dripWei: parseEther("0.1"), sentLast24hWei: 0n, dailyCapWei: parseEther("5") };

describe("decideDrip", () => {
  it("allows a first drip for the configured amount", () => {
    expect(decideDrip(base)).toEqual({ ok: true, amountWei: parseEther("0.1") });
  });
  it("refuses an address that was already dripped", () => {
    expect(decideDrip({ ...base, alreadyDripped: true })).toEqual({ ok: false, reason: "already_dripped" });
  });
  it("refuses while a drip to the same address is in flight", () => {
    expect(decideDrip({ ...base, inFlight: true })).toEqual({ ok: false, reason: "in_flight" });
  });
  it("allows a drip that lands exactly on the daily cap and refuses one past it", () => {
    expect(decideDrip({ ...base, sentLast24hWei: parseEther("4.9") }).ok).toBe(true);
    expect(decideDrip({ ...base, sentLast24hWei: parseEther("4.95") })).toEqual({ ok: false, reason: "daily_cap" });
  });
});

describe("topUpAmount", () => {
  const t = parseEther("0.02");
  const target = parseEther("0.1");
  it("sends nothing at or above the threshold", () => {
    expect(topUpAmount(t, t, target)).toBe(0n);
    expect(topUpAmount(parseEther("0.05"), t, target)).toBe(0n);
  });
  it("tops up to the target, not by a fixed amount", () => {
    expect(topUpAmount(parseEther("0.019"), t, target)).toBe(parseEther("0.081"));
    expect(topUpAmount(0n, t, target)).toBe(target);
  });
});

describe("planTopUps", () => {
  const opts = { thresholdWei: parseEther("0.02"), targetWei: parseEther("0.1") };
  it("skips healthy balances and serves low ones in order", () => {
    const plan = planTopUps(
      [
        { address: "a", balanceWei: parseEther("0.5") },
        { address: "b", balanceWei: 0n },
        { address: "c", balanceWei: parseEther("0.01") },
      ],
      { ...opts, budgetWei: parseEther("1") },
    );
    expect(plan.sends).toEqual([
      { address: "b", amountWei: parseEther("0.1") },
      { address: "c", amountWei: parseEther("0.09") },
    ]);
    expect(plan.skipped).toEqual([]);
  });
  it("reports participants that do not fit the remaining budget instead of dropping them", () => {
    const plan = planTopUps(
      [
        { address: "b", balanceWei: 0n },
        { address: "c", balanceWei: 0n },
      ],
      { ...opts, budgetWei: parseEther("0.15") },
    );
    expect(plan.sends.map((s) => s.address)).toEqual(["b"]);
    expect(plan.skipped).toEqual(["c"]);
  });
});
