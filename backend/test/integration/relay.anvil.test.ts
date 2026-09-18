/**
 * End-to-end against a real chain: a local anvil node running the real compiled Kokonad contracts
 * behind OpenZeppelin's ERC2771Forwarder, with the relay server in front.
 *
 * Proves a host and a player who hold zero MON can do everything through signed requests: create a
 * room, fund it, join it. Also proves the relay refuses forged, replayed, reverting and off-target
 * requests, and that the minimal ABIs in src/abi.ts match the real contracts.
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
  encodeFunctionData,
  http,
  parseEther,
  type Abi,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ViemChain } from "../../src/chain.js";
import { loadConfig } from "../../src/config.js";
import { Ledger } from "../../src/ledger.js";
import { RelayService } from "../../src/relay.js";
import { signForwardRequest } from "../../src/request.js";
import { createRelayServer } from "../../src/server.js";

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACTS = resolve(here, "../../../contracts");
// Anvil's well-known dev keys (public, local chain only).
const DEPLOYER_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RELAYER_KEY: Hex = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

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
let forwarder: Address;
let tokenAddr: Address;
let factoryAddr: Address;
let room: Address;
let code: string;
const roomAbi = () => artifact("Room.sol", "Room").abi;
const tokenAbi = () => artifact("KokoToken.sol", "KokoToken").abi;
const factoryAbi = () => artifact("RoomFactory.sol", "RoomFactory").abi;
const forwarderAbi = () => artifact("ERC2771Forwarder.sol", "ERC2771Forwarder").abi;
const host = privateKeyToAccount(generatePrivateKey());

const post = (body: unknown) =>
  fetch(`${base}/relay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function signed(account: LocalAccount, to: Address, data: Hex, gas?: bigint) {
  const nonce = (await pub.readContract({ address: forwarder, abi: forwarderAbi(), functionName: "nonces", args: [account.address] })) as bigint;
  const deadline = Number((await pub.getBlock()).timestamp) + 600;
  return signForwardRequest({ account, forwarder, chainId: 31337, to, data, nonce, gas, deadline });
}

async function relayOk(account: LocalAccount, to: Address, data: Hex, gas?: bigint) {
  const r = await post(await signed(account, to, data, gas));
  const body = (await r.json()) as { status: string; txHash?: Hex; reason?: string; detail?: string };
  expect(body, JSON.stringify(body)).toMatchObject({ status: "relayed" });
  return pub.waitForTransactionReceipt({ hash: body.txHash! });
}

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

beforeAll(async () => {
  if (!existsSync(join(CONTRACTS, "out", "ERC2771Forwarder.sol", "ERC2771Forwarder.json"))) {
    execFileSync("forge", ["build"], { cwd: CONTRACTS, stdio: "inherit" });
  }
  const port = 20000 + Math.floor(Math.random() * 20000);
  rpcUrl = `http://127.0.0.1:${port}`;
  anvil = spawn("anvil", ["--port", String(port), "--silent"], { stdio: "ignore" });
  await waitForRpc(rpcUrl);

  chain = defineChain({ id: 31337, name: "anvil", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const deployer = createWalletClient({ account: privateKeyToAccount(DEPLOYER_KEY), chain, transport: http(rpcUrl) });
  const deploy = async (a: { abi: Abi; bytecode: Hex }, args: unknown[]) =>
    (await pub.waitForTransactionReceipt({ hash: await deployer.deployContract({ chain, abi: a.abi, bytecode: a.bytecode, args }) })).contractAddress!;
  forwarder = await deploy(artifact("ERC2771Forwarder.sol", "ERC2771Forwarder"), ["Kokonad"]);
  tokenAddr = await deploy(artifact("KokoToken.sol", "KokoToken"), [forwarder]);
  factoryAddr = await deploy(artifact("RoomFactory.sol", "RoomFactory"), [forwarder]);

  // Configure the service exactly the way production does: from a deployments file + env.
  const dir = mkdtempSync(join(tmpdir(), "kokonad-int-"));
  const deploymentsPath = join(dir, "31337.json");
  writeFileSync(deploymentsPath, JSON.stringify({ chainId: 31337, contracts: { KokoToken: tokenAddr, RoomFactory: factoryAddr, Forwarder: forwarder } }));
  const config = loadConfig({ RPC_URL: rpcUrl, RELAYER_PRIVATE_KEY: RELAYER_KEY, DEPLOYMENTS_PATH: deploymentsPath, RELAY_LEDGER_PATH: join(dir, "ledger.json") });
  const viemChain = new ViemChain({ rpcUrl, chainId: config.deployments.chainId, operatorKey: config.operatorKey, contracts: config.deployments.contracts });
  server = createRelayServer(new RelayService(viemChain, new Ledger(config.ledgerPath), config));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  anvil?.kill();
});

describe("relay against real contracts on anvil", () => {
  it("a host with zero MON creates and funds a sponsored room entirely through signed requests", async () => {
    expect(await pub.getBalance({ address: host.address })).toBe(0n);
    const cfg = { token: tokenAddr, playPrice: parseEther("1"), startingDeposit: parseEther("20"), sponsored: true, hostPlays: false };
    const created = await relayOk(host, factoryAddr, encodeFunctionData({ abi: factoryAbi(), functionName: "createRoom", args: [cfg] }), 6_000_000n);
    const ev = created.logs
      .map((l) => { try { return decodeEventLog({ abi: factoryAbi(), data: l.data, topics: l.topics }); } catch { return null; } })
      .find((e) => e?.eventName === "RoomCreated");
    ({ room, code } = ev!.args as unknown as { room: Address; code: string });
    expect((ev!.args as unknown as { host: Address }).host).toBe(host.address);

    const budget = parseEther("200");
    await relayOk(host, tokenAddr, encodeFunctionData({ abi: tokenAbi(), functionName: "mint", args: [host.address, budget] }));
    await relayOk(host, tokenAddr, encodeFunctionData({ abi: tokenAbi(), functionName: "approve", args: [room, budget] }));
    await relayOk(host, room, encodeFunctionData({ abi: roomAbi(), functionName: "fundBudget", args: [budget] }));
    expect(await pub.readContract({ address: room, abi: roomAbi(), functionName: "budget" })).toBe(budget);
    expect(await pub.getBalance({ address: host.address })).toBe(0n);
  });

  it("a player with zero MON joins through the relay and is credited as themselves", async () => {
    const player = privateKeyToAccount(generatePrivateKey());
    const receipt = await relayOk(player, room, encodeFunctionData({ abi: roomAbi(), functionName: "join", args: [code, "Ayu"] }));
    const joined = receipt.logs
      .map((l) => { try { return decodeEventLog({ abi: roomAbi(), data: l.data, topics: l.topics }); } catch { return null; } })
      .find((e) => e?.eventName === "Joined");
    expect(joined?.args).toMatchObject({ participant: player.address, displayName: "Ayu" });
    expect(await pub.readContract({ address: room, abi: roomAbi(), functionName: "joined", args: [player.address] })).toBe(true);
    expect(await pub.getBalance({ address: player.address })).toBe(0n);

    // Joining again would revert: refused before the relayer pays, with the contract's reason.
    const again = await post(await signed(player, room, encodeFunctionData({ abi: roomAbi(), functionName: "join", args: [code, "Ayu"] })));
    expect(again.status).toBe(422);
    expect(await again.json()).toEqual({ status: "refused", reason: "call_would_revert", detail: "AlreadyJoined" });
  });

  it("refuses a request whose claimed sender is not the signer", async () => {
    const alice = privateKeyToAccount(generatePrivateKey());
    const bob = privateKeyToAccount(generatePrivateKey());
    const body = await signed(alice, room, encodeFunctionData({ abi: roomAbi(), functionName: "join", args: [code, "Bob"] }));
    body.request.from = bob.address;
    const r = await post(body);
    expect(r.status).toBe(401);
    expect(await pub.readContract({ address: room, abi: roomAbi(), functionName: "joined", args: [bob.address] })).toBe(false);
  });

  it("refuses a replay of a request that already ran", async () => {
    const p = privateKeyToAccount(generatePrivateKey());
    const body = await signed(p, room, encodeFunctionData({ abi: roomAbi(), functionName: "join", args: [code, "Citra"] }));
    expect((await post(body)).status).toBe(200);
    expect((await post(body)).status).toBe(401);
  });

  it("refuses targets outside Kokonad, including a contract that is not a factory room", async () => {
    const p = privateKeyToAccount(generatePrivateKey());
    const r1 = await post(await signed(p, forwarder, "0x"));
    expect(r1.status).toBe(403);
    const r2 = await post(await signed(p, "0x000000000000000000000000000000000000dEaD", "0x"));
    expect(r2.status).toBe(403);
  });
});
