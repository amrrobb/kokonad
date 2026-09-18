import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { DripService } from "../../src/drip.js";
import { Ledger } from "../../src/ledger.js";
import { createDripServer } from "../../src/server.js";
import { FakeChain } from "./fakeChain.js";

const ALICE = "0x1111111111111111111111111111111111111111";
let chain: FakeChain;
let base: string;
let close: () => Promise<void>;

beforeEach(async () => {
  chain = new FakeChain();
  chain.addRoom("ABCDEF", "0x00000000000000000000000000000000000000f1", [ALICE]);
  const ledger = new Ledger(join(mkdtempSync(join(tmpdir(), "kokonad-srv-")), "l.json"));
  const service = new DripService(chain, ledger, {
    dripWei: parseEther("0.1"),
    topUpThresholdWei: parseEther("0.02"),
    topUpTargetWei: parseEther("0.1"),
    dailyCapWei: parseEther("5"),
    roomDripsPerHour: 60,
    roomTopUpIntervalMs: 10_000,
    addressRequestsPerMinute: 5,
  });
  const server = createDripServer(service, { allowedOrigin: "http://localhost:3000" });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
afterEach(() => close());

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("HTTP", () => {
  it("returns 200 with the amount as a decimal string on a first drip, 409 on the second", async () => {
    const first = await post("/drip", { address: ALICE, code: "ABCDEF" });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: "sent", amountWei: "100000000000000000" });
    expect((await post("/drip", { address: ALICE, code: "ABCDEF" })).status).toBe(409);
  });

  it("maps refusals to status codes", async () => {
    expect((await post("/drip", { address: ALICE, code: "ZZZZZZ" })).status).toBe(404);
    expect((await post("/drip", { address: "nope", code: "ABCDEF" })).status).toBe(400);
    expect((await post("/drip", {})).status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const r = await fetch(`${base}/drip`, { method: "POST", body: "{not json" });
    expect(r.status).toBe(400);
  });

  it("returns 502, not a refusal, when the chain read fails", async () => {
    chain.failResolve = true;
    const r = await post("/drip", { address: ALICE, code: "ABCDEF" });
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ status: "error", reason: "upstream_failed" });
  });

  it("runs a top-up round", async () => {
    const r = await post("/topup", { code: "ABCDEF" });
    expect(r.status).toBe(200);
    expect(chain.sends).toHaveLength(1);
  });

  it("answers health and CORS preflight", async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
    const pre = await fetch(`${base}/drip`, { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});
