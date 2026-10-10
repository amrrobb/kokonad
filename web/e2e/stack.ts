/**
 * Brings up everything the app needs, locally, and tears it down again.
 *
 *   anvil (chain id 10143, 1 s blocks)  →  real Forwarder / KokoToken / RoomFactory deployed from contracts/out
 *   backend relayer                     →  the real service, pointed at anvil, paying with an anvil dev key
 *   web                                 →  `next build` + `next start` with the local addresses
 *
 * Players' accounts are created by the app itself, one per browser context, exactly as for a real
 * participant; the suite never injects a key into a page.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const WEB = resolve(__dirname, "..");
const ROOT = resolve(WEB, "..");

/**
 * "local" (default): the hermetic stack described above.
 * "testnet": E2E_TARGET=testnet drives the app you already have running (`pnpm dev` + the relayer) against
 * real Monad testnet. Nothing is started or stopped; the relayer pays real testnet MON for every step.
 */
export const TARGET: "local" | "testnet" = process.env.E2E_TARGET === "testnet" ? "testnet" : "local";

function fromEnvLocal(name: string): string | undefined {
  try {
    const line = readFileSync(join(WEB, ".env.local"), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Where global setup leaves the addresses for the specs (separate worker processes) to read.
 * One file per target, so a local and a testnet run never overwrite each other's addresses.
 * Not under test-results/: Playwright empties that folder when a run starts.
 */
export const STATE_FILE = join(tmpdir(), `kokonad-e2e-stack-${TARGET}.json`);

export const ANVIL_PORT = 8546;
export const RELAY_PORT = 8788;
export const WEB_PORT = 3101;
export const RPC_URL = TARGET === "testnet" ? (fromEnvLocal("NEXT_PUBLIC_MONAD_RPC_URL") ?? "https://testnet-rpc.monad.xyz") : `http://127.0.0.1:${ANVIL_PORT}`;
export const RELAY_URL = TARGET === "testnet" ? (fromEnvLocal("NEXT_PUBLIC_RELAY_URL") ?? "http://localhost:8787") : `http://localhost:${RELAY_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const CHAIN_ID = 10143;
export const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

const CONTRACTS = join(ROOT, "contracts");
const BACKEND = join(ROOT, "backend");

// Anvil's well-known dev keys: public, worthless, local chain only.
const DEPLOYER_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RELAYER_KEY: Hex = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

export const chain = defineChain({
  id: CHAIN_ID,
  name: "anvil as Monad testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export interface StackState {
  contracts: { Forwarder: Address; KokoToken: Address; RoomFactory: Address };
}

function artifact(file: string, name: string): { abi: Abi; bytecode: Hex } {
  const json = JSON.parse(readFileSync(join(CONTRACTS, "out", file, `${name}.json`), "utf8"));
  return { abi: json.abi as Abi, bytecode: json.bytecode.object as Hex };
}

async function waitFor(what: string, probe: () => Promise<boolean>, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (await probe()) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${what} did not come up within ${ms / 1000}s`);
}

async function portFree(port: number): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) });
  } catch {
    return; // nothing answers: free
  }
  throw new Error(`port ${port} is already in use; stop whatever holds it (an earlier e2e run?) and retry`);
}

const children: ChildProcess[] = [];
function start(cmd: string, args: string[], opts: { cwd: string; env: Record<string, string | undefined>; log: string }): ChildProcess {
  const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
  const chunks: string[] = [];
  const keep = (b: Buffer) => {
    chunks.push(b.toString());
    writeFileSync(opts.log, chunks.join(""));
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  children.push(child);
  return child;
}

export function stopStack(): void {
  for (const c of children.splice(0).reverse()) c.kill("SIGTERM");
}

/**
 * Testnet target: the running relayer (backend/, :8787) and the real chain, but a PRODUCTION build of
 * this app served here on WEB_PORT. `next dev` is not a fit for a proof run: its HMR tooling crashed
 * mid-game on 10 Oct and logged errors into the host tab that had nothing to do with the product.
 * Reads web/.env.local for the Dynamic environment, RPC and relay URL, exactly like the app itself.
 */
export async function attachToRunningStack(): Promise<StackState> {
  await waitFor(`relayer at ${RELAY_URL} (start it with pnpm start in backend/)`, async () => (await fetch(`${RELAY_URL}/health`)).ok, 5_000);
  const pub = createPublicClient({ chain, transport: http(RPC_URL) });
  if ((await pub.getChainId()) !== CHAIN_ID) throw new Error(`RPC is not chain ${CHAIN_ID}`);
  const file = JSON.parse(readFileSync(join(ROOT, "deployments", "10143.json"), "utf8")) as StackState;
  await portFree(WEB_PORT);
  const logs = mkdtempSync(join(tmpdir(), "kokonad-e2e-testnet-"));
  const webEnv: Record<string, string | undefined> = { ...process.env, NEXT_DIST_DIR: ".next-e2e" };
  delete webEnv.NEXT_PUBLIC_DEPLOYMENTS_JSON; // the real deployments file is the source here
  const next = join(WEB, "node_modules", ".bin", "next");
  try {
    execFileSync(next, ["build"], { cwd: WEB, env: webEnv as NodeJS.ProcessEnv, stdio: "pipe" });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`next build failed:\n${e.stdout?.toString() ?? ""}\n${e.stderr?.toString() ?? ""}`);
  }
  start(next, ["start", "-p", String(WEB_PORT)], { cwd: WEB, env: webEnv, log: join(logs, "web.log") });
  await waitFor("web", async () => (await fetch(WEB_URL)).ok, 60_000);
  console.log(`[e2e] TESTNET target: ${WEB_URL} (production build), relayer ${RELAY_URL}. Every step spends real testnet MON. logs: ${logs}`);
  return { contracts: file.contracts };
}

export async function startStack(): Promise<StackState> {
  const logs = mkdtempSync(join(tmpdir(), "kokonad-e2e-"));
  try {
    for (const p of [ANVIL_PORT, RELAY_PORT, WEB_PORT]) await portFree(p);
    if (!existsSync(join(CONTRACTS, "out", "ERC2771Forwarder.sol", "ERC2771Forwarder.json"))) {
      execFileSync("forge", ["build"], { cwd: CONTRACTS, stdio: "inherit" });
    }

    // 1. Chain. Blocks tick every second like a live chain: the app's "is it time yet" checks are
    //    dry runs against the latest block, which would never advance on an automine-only node.
    start("anvil", ["--port", String(ANVIL_PORT), "--chain-id", String(CHAIN_ID), "--block-time", "1", "--silent"], {
      cwd: ROOT,
      env: process.env,
      log: join(logs, "anvil.log"),
    });
    const pub = createPublicClient({ chain, transport: http(RPC_URL) });
    await waitFor("anvil", async () => (await pub.getChainId()) === CHAIN_ID, 15_000);

    // The app batches reads through Multicall3 at its canonical address; anvil starts without it.
    const multicallCode = readFileSync(join(__dirname, "fixtures", "multicall3.hex"), "utf8").trim() as Hex;
    await pub.request({ method: "anvil_setCode" as never, params: [MULTICALL3, multicallCode] as never });

    // 2. Contracts, from the same artifacts `forge build` produces for the real deploy.
    const deployer = createWalletClient({ account: privateKeyToAccount(DEPLOYER_KEY), chain, transport: http(RPC_URL) });
    const deploy = async (a: { abi: Abi; bytecode: Hex }, args: unknown[]) =>
      (await pub.waitForTransactionReceipt({ hash: await deployer.deployContract({ abi: a.abi, bytecode: a.bytecode, args }) })).contractAddress as Address;
    const Forwarder = await deploy(artifact("ERC2771Forwarder.sol", "ERC2771Forwarder"), ["Kokonad"]);
    const KokoToken = await deploy(artifact("KokoToken.sol", "KokoToken"), [Forwarder]);
    const RoomFactory = await deploy(artifact("RoomFactory.sol", "RoomFactory"), [Forwarder]);
    const deployments = {
      chainId: CHAIN_ID,
      network: "anvil-e2e",
      contracts: { Forwarder, KokoToken, RoomFactory },
      infrastructure: { Multicall3: MULTICALL3 },
    };
    const deploymentsPath = join(logs, "10143.json");
    writeFileSync(deploymentsPath, JSON.stringify(deployments));

    // 3. Relayer. Its environment is built from scratch: backend/.env (the real testnet key) is never read.
    start(join(BACKEND, "node_modules", ".bin", "tsx"), ["src/index.ts"], {
      cwd: BACKEND,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        RPC_URL,
        RELAYER_PRIVATE_KEY: RELAYER_KEY,
        DEPLOYMENTS_PATH: deploymentsPath,
        RELAY_LEDGER_PATH: join(logs, "relay-ledger.json"),
        PORT: String(RELAY_PORT),
        ALLOWED_ORIGIN: WEB_URL,
      },
      log: join(logs, "relay.log"),
    });
    await waitFor("relayer", async () => (await fetch(`${RELAY_URL}/health`)).ok, 30_000);

    // 4. Web: a production build that knows only the local chain. Sign-in provider off, so the run
    //    depends on nothing outside this machine.
    const webEnv = {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_MONAD_RPC_URL: RPC_URL,
      NEXT_PUBLIC_RELAY_URL: RELAY_URL,
      NEXT_PUBLIC_DEPLOYMENTS_JSON: JSON.stringify(deployments),
      NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: "",
    };
    const next = join(WEB, "node_modules", ".bin", "next");
    try {
      execFileSync(next, ["build"], { cwd: WEB, env: webEnv, stdio: "pipe" });
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(`next build failed:\n${e.stdout?.toString() ?? ""}\n${e.stderr?.toString() ?? ""}`);
    }
    start(next, ["start", "-p", String(WEB_PORT)], { cwd: WEB, env: webEnv, log: join(logs, "web.log") });
    await waitFor("web", async () => (await fetch(WEB_URL)).ok, 60_000);

    console.log(`[e2e] stack up. logs: ${logs}`);
    return { contracts: deployments.contracts };
  } catch (err) {
    stopStack();
    throw new Error(`${String(err)}\n(logs: ${logs})`);
  }
}
