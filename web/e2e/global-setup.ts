import { writeFileSync } from "node:fs";
import { STATE_FILE, TARGET, startStack, stopStack, attachToRunningStack } from "./stack";

export default async function globalSetup() {
  const state = TARGET === "testnet" ? await attachToRunningStack() : await startStack();
  writeFileSync(STATE_FILE, JSON.stringify(state));
  return async () => stopStack();
}
