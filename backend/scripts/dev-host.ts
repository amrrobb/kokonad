/**
 * Dev-only host driver until the host screen exists. Acts as the host whose key is in
 * .data/dev-host-key.txt (gitignored) for the room in .data/dev-room.json, through the relayer,
 * exactly as the host screen will: the host signs, the relayer pays.
 *
 *   tsx scripts/dev-host.ts open "Question?" "A|B|C" [timerSeconds]
 *   tsx scripts/dev-host.ts resolve <id> <optionIndex>
 *   tsx scripts/dev-host.ts settle <id>
 *   tsx scripts/dev-host.ts status <id>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, defineChain, encodeAbiParameters, encodeFunctionData, http, keccak256, numberToHex, type Abi, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { signForwardRequest } from "../src/request.js";

const env = Object.fromEntries(readFileSync(".env", "utf8").split("\n").map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m![1], (m![2] ?? "").trim()]));
const dep = JSON.parse(readFileSync("../deployments/10143.json", "utf8"));
const { room } = JSON.parse(readFileSync(".data/dev-room.json", "utf8")) as { room: Address };
const host = privateKeyToAccount(readFileSync(".data/dev-host-key.txt", "utf8").trim() as Hex);
const roomAbi = JSON.parse(readFileSync("../contracts/out/Room.sol/Room.json", "utf8")).abi as Abi;
const fwdAbi = JSON.parse(readFileSync("../contracts/out/ERC2771Forwarder.sol/ERC2771Forwarder.json", "utf8")).abi as Abi;
const chain = defineChain({ id: 10143, name: "monad-testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [env.RPC_URL!] } } });
const pub = createPublicClient({ chain, transport: http() });
const RELAY = process.env.RELAY_URL ?? "http://127.0.0.1:8787";
const SALTS = ".data/dev-host-salts.json";

async function relay(fn: string, args: unknown[], gas = 2_000_000n) {
  const data = encodeFunctionData({ abi: roomAbi, functionName: fn, args });
  const nonce = (await pub.readContract({ address: dep.contracts.Forwarder, abi: fwdAbi, functionName: "nonces", args: [host.address] })) as bigint;
  const body = await signForwardRequest({ account: host, forwarder: dep.contracts.Forwarder, chainId: 10143, to: room, data, nonce, gas, deadline: Math.floor(Date.now() / 1000) + 600 });
  const res = (await (await fetch(`${RELAY}/relay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json()) as { txHash?: Hex; reason?: string; detail?: string };
  if (!res.txHash) throw new Error(`${fn} refused: ${res.reason} ${res.detail ?? ""}`);
  await pub.waitForTransactionReceipt({ hash: res.txHash });
  return res.txHash;
}
const read = (fn: string, args: unknown[] = []) => pub.readContract({ address: room, abi: roomAbi, functionName: fn, args });

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "open") {
  const [text, opts, timer = "30"] = rest;
  const options = opts!.split("|");
  const salt = generatePrivateKey(); // 32 random bytes; the host keeps it until opening
  const hash = keccak256(encodeAbiParameters(
    [{ type: "string" }, { type: "string[]" }, { type: "uint8" }, { type: "uint8" }, { type: "uint8" }, { type: "bytes32" }],
    [text!, options, 0, 0, 0, salt],
  ));
  const id = (await read("questionCount")) as bigint;
  const salts = existsSync(SALTS) ? JSON.parse(readFileSync(SALTS, "utf8")) : {};
  salts[`${room}:${id}`] = salt;
  writeFileSync(SALTS, JSON.stringify(salts), { mode: 0o600 });
  await relay("commitQuestions", [[hash]]);
  const tx = await relay("openQuestion", [id, text, options, 0, 0, 0, salt, 0n, Number(timer)], 3_000_000n);
  const q = (await read("getQuestion", [id])) as { pot: bigint; charged: number; lockAt: bigint };
  console.log(`opened question ${id}: pot ${Number(q.pot) / 1e18}, charged ${q.charged}, locks at ${new Date(Number(q.lockAt) * 1000).toISOString()} (tx ${tx})`);
} else if (cmd === "resolve") {
  const [id, idx] = rest;
  const tx = await relay("resolve", [BigInt(id!), numberToHex(BigInt(idx!), { size: 32 })]);
  const q = (await read("getQuestion", [BigInt(id!)])) as { status: number; disputeUntil: bigint };
  console.log(`resolved question ${id} to option ${idx}: status ${q.status}, disputable until ${new Date(Number(q.disputeUntil) * 1000).toISOString()} (tx ${tx})`);
} else if (cmd === "settle") {
  const tx = await relay("settle", [BigInt(rest[0]!)]);
  console.log(`settled question ${rest[0]} (tx ${tx})`);
} else if (cmd === "status") {
  const q = (await read("getQuestion", [BigInt(rest[0]!)])) as Record<string, unknown>;
  console.log(JSON.stringify(q, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
} else {
  console.log("usage: open <text> <A|B|C> [timer] | resolve <id> <option> | settle <id> | status <id>");
}
