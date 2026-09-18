import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getAddress, parseEther, type Hex } from "viem";
import type { ForwardRequest } from "../../src/chain.js";
import { Ledger } from "../../src/ledger.js";
import { RelayService } from "../../src/relay.js";
import { FakeChain } from "./fakeChain.js";

const ALICE = getAddress("0x1111111111111111111111111111111111111111");
const BOB = getAddress("0x2222222222222222222222222222222222222222");
const ROOM = getAddress("0x00000000000000000000000000000000000000f1");
const STRANGER = getAddress("0x00000000000000000000000000000000000000ee");
const SIG = `0x${"ab".repeat(65)}` as Hex;

const limits = { dailyCapWei: parseEther("5"), maxRequestGas: 8_000_000n, signerRequestsPerMinute: 30, tokenCallsPerSignerPerHour: 4, tokenCallsPerHour: 30 };
let chain: FakeChain;
let ledgerPath: string;
let now: number;
const service = (o: Partial<typeof limits> = {}) => new RelayService(chain, new Ledger(ledgerPath), { ...limits, ...o }, () => now);
const req = (o: Partial<ForwardRequest> = {}): ForwardRequest => ({
  from: ALICE, to: ROOM, value: 0n, gas: 500_000n, deadline: Math.floor(now / 1000) + 600, data: "0x1234", signature: SIG, ...o,
});

beforeEach(() => {
  chain = new FakeChain();
  chain.rooms.add(ROOM.toLowerCase());
  ledgerPath = join(mkdtempSync(join(tmpdir(), "kokonad-relay-")), "ledger.json");
  now = 1_800_000_000_000;
});

describe("relay", () => {
  it("relays a valid request to a factory room and records the gas paid", async () => {
    const r = await service().relay(req());
    expect(r.status).toBe("relayed");
    expect(chain.executed).toHaveLength(1);
    expect(new Ledger(ledgerPath).spentSince(0)).toBe(chain.costWei);
  });

  it("allows the token and the factory as targets", async () => {
    expect((await service().relay(req({ to: chain.token }))).status).toBe("relayed");
    expect((await service().relay(req({ to: chain.factory }))).status).toBe("relayed");
  });

  it("refuses any other target, without verifying or sending", async () => {
    chain.verifies = false; // would give a different refusal if reached
    expect(await service().relay(req({ to: STRANGER }))).toEqual({ status: "refused", reason: "target_not_allowed" });
    expect(chain.executed).toHaveLength(0);
  });

  it("refuses a request the forwarder does not verify", async () => {
    chain.verifies = false;
    expect(await service().relay(req())).toEqual({ status: "refused", reason: "bad_signature" });
    expect(chain.executed).toHaveLength(0);
  });

  it("refuses a request whose call would revert, and says why, without paying for it", async () => {
    chain.simulation = { ok: false, reason: "AlreadyJoined" };
    expect(await service().relay(req())).toEqual({ status: "refused", reason: "call_would_revert", detail: "AlreadyJoined" });
    expect(chain.executed).toHaveLength(0);
  });

  it("refuses value transfers, oversized gas and bad deadlines before touching the chain", async () => {
    chain.failRead = true; // would throw if reached
    expect((await service().relay(req({ value: 1n }))).status).toBe("refused");
    expect(await service().relay(req({ gas: 8_000_001n }))).toEqual({ status: "refused", reason: "gas_too_high" });
    expect(await service().relay(req({ gas: 0n }))).toEqual({ status: "refused", reason: "gas_too_high" });
    expect(await service().relay(req({ deadline: Math.floor(now / 1000) }))).toEqual({ status: "refused", reason: "deadline" });
    expect(await service().relay(req({ deadline: Math.floor(now / 1000) + 2 * 86400 }))).toEqual({ status: "refused", reason: "deadline" });
  });

  it("treats a failed chain read as an error, not as a refusal", async () => {
    chain.failRead = true;
    await expect(service().relay(req())).rejects.toThrow("rpc down");
  });

  it("does not record a relay whose send failed", async () => {
    chain.failExecute = true;
    await expect(service().relay(req())).rejects.toThrow("send failed");
    expect(new Ledger(ledgerPath).spentSince(0)).toBe(0n);
  });

  it("rate-limits per signer and keeps signers independent", async () => {
    const s = service({ signerRequestsPerMinute: 2 });
    await s.relay(req());
    await s.relay(req());
    expect(await s.relay(req())).toEqual({ status: "refused", reason: "rate_limited" });
    expect((await s.relay(req({ from: BOB }))).status).toBe("relayed");
    now += 60_001;
    expect((await s.relay(req())).status).toBe("relayed");
  });

  it("stops at the daily gas cap and frees it after 24 hours", async () => {
    const s = service({ dailyCapWei: chain.costWei * 2n });
    await s.relay(req());
    await s.relay(req({ from: BOB }));
    expect(await s.relay(req())).toEqual({ status: "refused", reason: "daily_cap" });
    now += 24 * 60 * 60 * 1000 + 1;
    expect((await s.relay(req())).status).toBe("relayed");
  });

  it("limits relayed token calls (open mint) far tighter than room calls", async () => {
    const s = service({ tokenCallsPerSignerPerHour: 2, tokenCallsPerHour: 3 });
    await s.relay(req({ to: chain.token }));
    await s.relay(req({ to: chain.token }));
    expect(await s.relay(req({ to: chain.token }))).toEqual({ status: "refused", reason: "rate_limited", detail: "token calls" });
    // Room calls from the same signer are unaffected.
    expect((await s.relay(req())).status).toBe("relayed");
    // The global limit stops many throwaway signers too.
    expect((await s.relay(req({ from: BOB, to: chain.token }))).status).toBe("relayed");
    const CAROL = getAddress("0x3333333333333333333333333333333333333333");
    expect(await s.relay(req({ from: CAROL, to: chain.token }))).toEqual({ status: "refused", reason: "rate_limited", detail: "token calls" });
    now += 60 * 60 * 1000 + 1;
    expect((await s.relay(req({ from: CAROL, to: chain.token }))).status).toBe("relayed");
  });
});

describe("parse", () => {
  const body = { request: { from: ALICE, to: ROOM, value: "0", gas: "500000", deadline: 1800000600, data: "0x1234", signature: SIG } };
  it("accepts decimal strings and numbers", () => {
    expect(RelayService.parse(body)).toMatchObject({ from: ALICE, gas: 500000n, deadline: 1800000600 });
  });
  it("rejects malformed fields", () => {
    expect(RelayService.parse({})).toEqual({ error: "missing request" });
    expect(RelayService.parse({ request: { ...body.request, from: "0xnope" } })).toEqual({ error: "from" });
    expect(RelayService.parse({ request: { ...body.request, signature: "0x12" } })).toEqual({ error: "signature" });
    expect("error" in (RelayService.parse({ request: { ...body.request, gas: "-1" } }) as object)).toBe(true);
    expect("error" in (RelayService.parse({ request: { ...body.request, gas: 1.5 } }) as object)).toBe(true);
  });
});
