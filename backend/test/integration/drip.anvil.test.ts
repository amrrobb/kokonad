/**
 * End-to-end against a real chain: a local anvil node running the real compiled Kokonad contracts.
 *
 * Proves the path a participant takes on first sign-in: a brand-new account with zero gas asks the
 * drip server for gas, receives it, and can then actually join a room on its own. Also checks the
 * top-up before a question and that the minimal ABIs in src/abi.ts match the deployed contracts.
 *
 * Needs `anvil` and `forge` on PATH (Foundry). Contracts are built on demand.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
  parseEther,
  type Abi,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ViemChain } from "../../src/chain.js";
import { loadConfig } from "../../src/config.js";
import { DripService } from "../../src/drip.js";
import { Ledger } from "../../src/ledger.js";
import { createDripServer } from "../../src/server.js";

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACTS = resolve(here, "../../../contracts");
// Anvil's well-known dev keys (public, local chain only).
const HOST_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const OPERATOR_KEY: Hex = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

function artifact(file: string, name: string): { abi: Abi; bytecode: Hex } {
  const json = JSON.parse(readFileSync(join(CONTRACTS, "out", file, `${name}.json`), "utf8"));
  return { abi: json.abi as Abi, bytecode: json.bytecode.object as Hex };
}

let anvil: ChildProcess;
let rpcUrl: string;
let server: Server;
let base: string;
let pub: PublicClient;
let chain: Chain;
let room: Address;
let code: string;
let roomAbi: Abi;
let ledgerPath: string;

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function waitForRpc(url: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("anvil did not start");
}

async function joinAs(key: Hex, name: string) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const hash = await wallet.writeContract({ chain, address: room, abi: roomAbi, functionName: "join", args: [code, name] });
  return pub.waitForTransactionReceipt({ hash });
}

beforeAll(async () => {
  if (!existsSync(join(CONTRACTS, "out", "RoomFactory.sol", "RoomFactory.json"))) {
    execFileSync("forge", ["build"], { cwd: CONTRACTS, stdio: "inherit" });
  }

  const port = 20000 + Math.floor(Math.random() * 20000);
  rpcUrl = `http://127.0.0.1:${port}`;
  anvil = spawn("anvil", ["--port", String(port), "--silent"], { stdio: "ignore" });
  await waitForRpc(rpcUrl);

  chain = defineChain({ id: 31337, name: "anvil", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const host = createWalletClient({ account: privateKeyToAccount(HOST_KEY), chain, transport: http(rpcUrl) });

  // Deploy the real contracts.
  const token = artifact("KokoToken.sol", "KokoToken");
  const factory = artifact("RoomFactory.sol", "RoomFactory");
  roomAbi = artifact("Room.sol", "Room").abi;
  const tokenAddr = (await pub.waitForTransactionReceipt({ hash: await host.deployContract({ chain, abi: token.abi, bytecode: token.bytecode }) })).contractAddress!;
  const factoryAddr = (await pub.waitForTransactionReceipt({ hash: await host.deployContract({ chain, abi: factory.abi, bytecode: factory.bytecode }) })).contractAddress!;

  // Host creates a sponsored room and funds its budget, as the host screen will.
  const cfg = { token: tokenAddr, playPrice: parseEther("1"), startingDeposit: parseEther("20"), sponsored: true, hostPlays: false };
  // The code is derived from the block it lands in, so read it from the event, not from a simulation.
  const created = await pub.waitForTransactionReceipt({ hash: await host.writeContract({ chain, address: factoryAddr, abi: factory.abi, functionName: "createRoom", args: [cfg] }) });
  const ev = created.logs
    .map((l) => { try { return decodeEventLog({ abi: factory.abi, data: l.data, topics: l.topics }); } catch { return null; } })
    .find((e) => e?.eventName === "RoomCreated");
  ({ room, code } = ev!.args as unknown as { room: Address; code: string });
  const budget = parseEther("200");
  await pub.waitForTransactionReceipt({ hash: await host.writeContract({ chain, address: tokenAddr, abi: token.abi, functionName: "mint", args: [host.account.address, budget] }) });
  await pub.waitForTransactionReceipt({ hash: await host.writeContract({ chain, address: tokenAddr, abi: token.abi, functionName: "approve", args: [room, budget] }) });
  await pub.waitForTransactionReceipt({ hash: await host.writeContract({ chain, address: room, abi: roomAbi, functionName: "fundBudget", args: [budget] }) });

  // Configure the service exactly the way production does: from a deployments file + env.
  const dir = mkdtempSync(join(tmpdir(), "kokonad-int-"));
  const deploymentsPath = join(dir, "31337.json");
  writeFileSync(deploymentsPath, JSON.stringify({ chainId: 31337, contracts: { KokoToken: tokenAddr, RoomFactory: factoryAddr } }));
  ledgerPath = join(dir, "ledger.json");
  const config = loadConfig({ RPC_URL: rpcUrl, DRIP_OPERATOR_PRIVATE_KEY: OPERATOR_KEY, DEPLOYMENTS_PATH: deploymentsPath, DRIP_LEDGER_PATH: ledgerPath });

  const viemChain = new ViemChain({ rpcUrl, chainId: config.deployments.chainId, operatorKey: config.operatorKey, factory: config.deployments.contracts.RoomFactory });
  expect(await viemChain.getChainId()).toBe(config.deployments.chainId);
  server = createDripServer(new DripService(viemChain, new Ledger(config.ledgerPath), config));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  anvil?.kill();
});

describe("drip against real contracts on anvil", () => {
  it("a zero-balance account cannot join before the drip", async () => {
    const key = generatePrivateKey();
    expect(await pub.getBalance({ address: privateKeyToAccount(key).address })).toBe(0n);
    await expect(joinAs(key, "no gas")).rejects.toThrow();
  });

  it("drips a brand-new account, which can then join the room with that gas alone", async () => {
    const key = generatePrivateKey();
    const address = privateKeyToAccount(key).address;

    const r = await post("/drip", { address, code });
    expect(r.status).toBe(200);
    expect(await pub.getBalance({ address })).toBe(parseEther("0.1"));

    const receipt = await joinAs(key, "Ayu");
    expect(receipt.status).toBe("success");
    const joined = receipt.logs
      .map((l) => { try { return decodeEventLog({ abi: roomAbi, data: l.data, topics: l.topics }); } catch { return null; } })
      .find((e) => e?.eventName === "Joined");
    expect(joined?.args).toMatchObject({ participant: address, displayName: "Ayu" });

    // Second request is refused, balance only moved by the join's gas.
    expect((await post("/drip", { address, code })).status).toBe(409);
    expect(await pub.getBalance({ address })).toBeLessThan(parseEther("0.1"));
    expect(JSON.parse(readFileSync(ledgerPath, "utf8")).dripped[address.toLowerCase()]).toBeTruthy();
  });

  it("refuses a join code the real factory does not know (UnknownCode decoded, not an RPC error)", async () => {
    const r = await post("/drip", { address: privateKeyToAccount(generatePrivateKey()).address, code: "ZZZZZZ" });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ status: "refused", reason: "unknown_room" });
  });

  it("serves concurrent drips with distinct nonces, all mined", async () => {
    const addrs = [0, 1, 2, 3, 4].map(() => privateKeyToAccount(generatePrivateKey()).address);
    const results = await Promise.all(addrs.map((address) => post("/drip", { address, code })));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    for (const a of addrs) expect(await pub.getBalance({ address: a })).toBe(parseEther("0.1"));
  });

  it("tops up a participant who drained below 0.02 MON before the next question, and leaves others alone", async () => {
    const low = generatePrivateKey();
    const lowAddr = privateKeyToAccount(low).address;
    await post("/drip", { address: lowAddr, code });
    await joinAs(low, "Budi");

    // Spend most of the gas away, as if many answers had been sent.
    const w = createWalletClient({ account: privateKeyToAccount(low), chain, transport: http(rpcUrl) });
    const bal = await pub.getBalance({ address: lowAddr });
    await pub.waitForTransactionReceipt({ hash: await w.sendTransaction({ chain, to: "0x000000000000000000000000000000000000dEaD", value: bal - parseEther("0.019") }) });
    expect(await pub.getBalance({ address: lowAddr })).toBeLessThan(parseEther("0.02"));

    const participants = (await pub.readContract({ address: room, abi: roomAbi, functionName: "getParticipants" })) as Address[];
    const before = new Map(await Promise.all(participants.map(async (p) => [p, await pub.getBalance({ address: p })] as const)));

    const r = await post("/topup", { code });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { sent: Array<{ address: string }> };
    expect(body.sent.map((s) => s.address)).toEqual([lowAddr]);
    expect(await pub.getBalance({ address: lowAddr })).toBe(parseEther("0.1"));
    for (const p of participants) if (p !== lowAddr) expect(await pub.getBalance({ address: p })).toBe(before.get(p));
  });
});
