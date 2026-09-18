import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { Ledger } from "../../src/ledger.js";
import { RelayService } from "../../src/relay.js";
import { createRelayServer } from "../../src/server.js";
import { FakeChain } from "./fakeChain.js";

const ROOM = "0x00000000000000000000000000000000000000f1";
let chain: FakeChain;
let base: string;
let close: () => Promise<void>;
const nowS = Math.floor(Date.now() / 1000);
const request = (o: Record<string, unknown> = {}) => ({
  request: { from: "0x1111111111111111111111111111111111111111", to: ROOM, value: "0", gas: "500000", deadline: nowS + 600, data: "0x12", signature: `0x${"ab".repeat(65)}`, ...o },
});

beforeEach(async () => {
  chain = new FakeChain();
  chain.rooms.add(ROOM);
  const service = new RelayService(chain, new Ledger(join(mkdtempSync(join(tmpdir(), "kokonad-srv-")), "l.json")), {
    dailyCapWei: parseEther("5"), maxRequestGas: 8_000_000n, signerRequestsPerMinute: 30,
  });
  const server = createRelayServer(service, { allowedOrigin: "http://localhost:3000" });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
afterEach(() => close());

const post = (body: unknown) => fetch(`${base}/relay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("HTTP", () => {
  it("returns 200 with the tx hash when relayed", async () => {
    const r = await post(request());
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ status: "relayed" });
  });

  it("maps refusals to status codes", async () => {
    expect((await post(request({ to: "0x00000000000000000000000000000000000000ee" }))).status).toBe(403);
    chain.verifies = false;
    expect((await post(request())).status).toBe(401);
    chain.verifies = true;
    chain.simulation = { ok: false, reason: "AlreadyJoined" };
    const r = await post(request());
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ status: "refused", reason: "call_would_revert", detail: "AlreadyJoined" });
  });

  it("returns 400 on malformed input and invalid JSON", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post(request({ from: "nope" }))).status).toBe(400);
    expect((await fetch(`${base}/relay`, { method: "POST", body: "{not json" })).status).toBe(400);
  });

  it("returns 502, not a refusal, when the chain read fails", async () => {
    chain.failRead = true;
    const r = await post(request());
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ status: "error", reason: "upstream_failed" });
  });

  it("answers health and CORS preflight", async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
    const pre = await fetch(`${base}/relay`, { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});
