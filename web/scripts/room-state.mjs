// Usage (from web/): node scripts/room-state.mjs <CODE>   prints budget, deposit, play price, question count and who is in the room, from the chain.
import { createPublicClient, http, parseAbi } from "viem";
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("../deployments/10143.json","utf8"));
const rpc = readFileSync(".env.local","utf8").match(/^NEXT_PUBLIC_MONAD_RPC_URL=(.*)$/m)[1].trim();
const pub = createPublicClient({ transport: http(rpc) });
const room = await pub.readContract({ address: d.contracts?.RoomFactory ?? d.RoomFactory, abi: parseAbi(["function roomByCode(string) view returns (address)"]), functionName: "roomByCode", args: [process.argv[2]] });
const abi = parseAbi(["function getParticipants() view returns (address[])","function budget() view returns (uint128)","function startingDeposit() view returns (uint128)","function playPrice() view returns (uint128)","function questionCount() view returns (uint256)","function displayNames(address) view returns (string)"]);
const r = {};
for (const fn of ["budget","startingDeposit","playPrice","questionCount"]) r[fn] = String(await pub.readContract({ address: room, abi, functionName: fn }));
const people = await pub.readContract({ address: room, abi, functionName: "getParticipants" });
r.people = [];
for (const a of people) r.people.push(await pub.readContract({ address: room, abi, functionName: "displayNames", args: [a] }));
console.log(room, JSON.stringify(r));
