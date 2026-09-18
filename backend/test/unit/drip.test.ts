import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { DripService } from "../../src/drip.js";
import { Ledger } from "../../src/ledger.js";
import { FakeChain } from "./fakeChain.js";

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";
const CAROL = "0x3333333333333333333333333333333333333333";
const ROOM = "0x00000000000000000000000000000000000000f1";

const limits = {
  dripWei: parseEther("0.1"),
  topUpThresholdWei: parseEther("0.02"),
  topUpTargetWei: parseEther("0.1"),
  dailyCapWei: parseEther("5"),
  roomDripsPerHour: 60,
  roomTopUpIntervalMs: 10_000,
  addressRequestsPerMinute: 5,
};

let chain: FakeChain;
let ledgerPath: string;
let now: number;
const service = (overrides: Partial<typeof limits> = {}) =>
  new DripService(chain, new Ledger(ledgerPath), { ...limits, ...overrides }, () => now);

beforeEach(() => {
  chain = new FakeChain();
  chain.addRoom("ABCDEF", ROOM, [ALICE, BOB, CAROL]);
  ledgerPath = join(mkdtempSync(join(tmpdir(), "kokonad-drip-")), "ledger.json");
  now = 1_000_000;
});

describe("drip", () => {
  it("sends 0.1 MON once to a new participant of an existing room", async () => {
    const r = await service().drip(ALICE, "ABCDEF");
    expect(r.status).toBe("sent");
    expect(chain.sends).toEqual([{ to: ALICE, wei: parseEther("0.1") }]);
  });

  it("accepts a lowercase join code", async () => {
    expect((await service().drip(ALICE, "abcdef")).status).toBe("sent");
  });

  it("never drips the same address twice, including after a restart", async () => {
    await service().drip(ALICE, "ABCDEF");
    expect(await service().drip(ALICE.toLowerCase(), "ABCDEF")).toEqual({ status: "refused", reason: "already_dripped" });
    expect(chain.sends).toHaveLength(1);
  });

  it("sends exactly once when the same address asks concurrently", async () => {
    chain.sendDelayMs = 20;
    const s = service();
    const results = await Promise.all([s.drip(ALICE, "ABCDEF"), s.drip(ALICE, "ABCDEF"), s.drip(ALICE, "ABCDEF")]);
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1);
    expect(chain.sends).toHaveLength(1);
  });

  it("refuses an unknown room without sending", async () => {
    expect(await service().drip(ALICE, "ZZZZZZ")).toEqual({ status: "refused", reason: "unknown_room" });
    expect(chain.sends).toHaveLength(0);
  });

  it("treats a failed room lookup as an error, not as an unknown room", async () => {
    chain.failResolve = true;
    await expect(service().drip(ALICE, "ABCDEF")).rejects.toThrow("rpc down");
    expect(chain.sends).toHaveLength(0);
  });

  it("rejects malformed input before touching the chain", async () => {
    chain.failResolve = true; // would throw if reached
    expect(await service().drip("0xnope", "ABCDEF")).toEqual({ status: "refused", reason: "bad_address" });
    expect(await service().drip(ALICE, "ABC")).toEqual({ status: "refused", reason: "bad_code" });
    expect(await service().drip(ALICE, "ABCDE0")).toEqual({ status: "refused", reason: "bad_code" }); // 0 is not in the alphabet
  });

  it("does not record a drip whose send failed, so the participant can retry", async () => {
    const s = service();
    chain.failNextSend = true;
    await expect(s.drip(ALICE, "ABCDEF")).rejects.toThrow("send failed");
    expect(new Ledger(ledgerPath).hasDripped(ALICE)).toBe(false);
    expect((await s.drip(ALICE, "ABCDEF")).status).toBe("sent");
  });

  it("stops at the daily cap", async () => {
    const s = service({ dailyCapWei: parseEther("0.15") });
    expect((await s.drip(ALICE, "ABCDEF")).status).toBe("sent");
    expect(await s.drip(BOB, "ABCDEF")).toEqual({ status: "refused", reason: "daily_cap" });
  });

  it("frees the daily cap after 24 hours", async () => {
    const s = service({ dailyCapWei: parseEther("0.1") });
    await s.drip(ALICE, "ABCDEF");
    now += 24 * 60 * 60 * 1000 + 1;
    expect((await s.drip(BOB, "ABCDEF")).status).toBe("sent");
  });

  it("limits first-time drips per room per hour", async () => {
    const s = service({ roomDripsPerHour: 2 });
    await s.drip(ALICE, "ABCDEF");
    await s.drip(BOB, "ABCDEF");
    expect(await s.drip(CAROL, "ABCDEF")).toEqual({ status: "refused", reason: "room_limit" });
  });

  it("does not let repeat requests from a dripped address use up the room quota", async () => {
    const s = service({ roomDripsPerHour: 2, addressRequestsPerMinute: 100 });
    await s.drip(ALICE, "ABCDEF");
    for (let i = 0; i < 5; i++) await s.drip(ALICE, "ABCDEF");
    expect((await s.drip(BOB, "ABCDEF")).status).toBe("sent");
  });

  it("rate-limits requests per address", async () => {
    const s = service({ addressRequestsPerMinute: 2 });
    await s.drip(ALICE, "ABCDEF");
    await s.drip(ALICE, "ABCDEF");
    expect(await s.drip(ALICE, "ABCDEF")).toEqual({ status: "refused", reason: "rate_limited" });
  });
});

describe("topUpRoom", () => {
  it("tops up only participants below 0.02 MON, back to 0.1", async () => {
    chain.balances.set(ALICE.toLowerCase(), parseEther("0.5"));
    chain.balances.set(BOB.toLowerCase(), parseEther("0.015"));
    chain.balances.set(CAROL.toLowerCase(), 0n);
    const r = await service().topUpRoom("ABCDEF");
    expect(r.status).toBe("done");
    expect(chain.sends).toEqual([
      { to: BOB, wei: parseEther("0.085") },
      { to: CAROL, wei: parseEther("0.1") },
    ]);
  });

  it("skips participants who left the room", async () => {
    chain.left.add(BOB.toLowerCase());
    await service().topUpRoom("ABCDEF");
    expect(chain.sends.map((s) => s.to)).toEqual([ALICE, CAROL]);
  });

  it("allows one round per room per interval", async () => {
    const s = service();
    expect((await s.topUpRoom("ABCDEF")).status).toBe("done");
    expect(await s.topUpRoom("ABCDEF")).toEqual({ status: "refused", reason: "rate_limited" });
    now += 10_001;
    expect((await s.topUpRoom("ABCDEF")).status).toBe("done");
  });

  it("counts top-ups against the daily cap and reports who was skipped", async () => {
    const r = await service({ dailyCapWei: parseEther("0.15") }).topUpRoom("ABCDEF");
    expect(r).toMatchObject({ status: "done", skipped: [BOB, CAROL] });
    expect(chain.sends).toHaveLength(1);
  });

  it("reports a failed send and keeps going", async () => {
    chain.failNextSend = true;
    const r = await service().topUpRoom("ABCDEF");
    expect(r).toMatchObject({ status: "done", failed: [ALICE] });
    expect(chain.sends.map((s) => s.to)).toEqual([BOB, CAROL]);
  });

  it("refuses an unknown room", async () => {
    expect(await service().topUpRoom("ZZZZZZ")).toEqual({ status: "refused", reason: "unknown_room" });
  });
});
