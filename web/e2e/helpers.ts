import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { chain, RPC_URL, STATE_FILE, TARGET, type StackState } from "./stack";

export const stack = (): StackState => JSON.parse(readFileSync(STATE_FILE, "utf8")) as StackState;

/** Independent view of the chain. Screens are checked against this, never against themselves. */
export const pub = createPublicClient({ chain, transport: http(RPC_URL) });

export const factoryAbi = parseAbi(["function roomByCode(string code) view returns (address room)"]);
export const tokenAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
export const roomAbi = parseAbi([
  "function budget() view returns (uint128)",
  "function getParticipants() view returns (address[])",
  "function displayNames(address) view returns (string)",
  "function participants(address) view returns (uint128 deposit, bool joined, uint32 index)",
  "function getWinners(uint256 id) view returns (address[])",
  "function getQuestion(uint256 id) view returns ((bytes32 commitHash, string text, string[] options, uint8 template, uint8 rule, uint8 n, uint128 hostSeed, uint128 pot, uint32 charged, uint64 openAt, uint64 lockAt, uint64 revealUntil, uint64 disputeUntil, uint8 status, bytes32 outcome, address resolver, uint32 answerers, uint32 revealed, uint32 disputes))",
]);
/** Room.Status, PRD §8.1. */
export const Status = { DRAFT: 0, OPEN: 1, LOCKED: 2, REVEAL: 3, RESOLVED: 4, SETTLED: 5, VOIDED: 6 } as const;
export const COIN = 10n ** 18n;

/**
 * CLAUDE.md non-negotiable #2: participants never see crypto vocabulary. Whole words, so "designed"
 * or "exchange" cannot trip it, plus any 0x-prefixed hex.
 */
const BANNED = /\b(wallet|gas|transaction|hash|sign|signed|signature|chain|blockchain|tx|mon)\b|0x[0-9a-f]{4,}/i;
export async function expectPlainLanguage(page: Page, where: string): Promise<void> {
  const text = await page.innerText("body");
  const hit = text.match(BANNED);
  expect(hit, `${where}: participant screen shows "${hit?.[0]}" in: ${text.replace(/\s+/g, " ").slice(0, 300)}`).toBeNull();
}

export interface Tab {
  page: Page;
  label: string;
  /** Uncaught errors and console errors seen on this tab. */
  errors: string[];
  /** Every URL this tab asked for that is not on this machine. Answered by the suite, never by the network. */
  outside: string[];
}

/** An empty but well-formed catalogue: what the bundled sign-in SDK asks its CDN for on every page load. */
const OUTSIDE_STUB = JSON.stringify({ groups: {}, wallets: {} });
const isLocal = (url: string) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);

export async function openTab(browser: Browser, label: string, width: number, height: number, opts: { reducedMotion?: boolean } = {}): Promise<Tab> {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: opts.reducedMotion ? "reduce" : "no-preference" });
  const errors: string[] = [];
  const outside: string[] = [];
  // Hermetic: nothing a page asks for may reach the network. Requests that try are recorded and
  // answered with an empty document, so a run gives the same result with the cable unplugged.
  // (On the testnet target the page must reach the real RPC, so nothing is intercepted.)
  if (TARGET === "local") await context.route(
    (url) => !isLocal(url.href),
    (route) => {
      outside.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: OUTSIDE_STUB });
    },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { page, label, errors, outside };
}

/** A participant: opens /r/<code>, types a name, joins. The app creates the account on its own. */
export async function joinAs(browser: Browser, code: string, name: string, width = 360, height = 780, opts: { reducedMotion?: boolean } = {}): Promise<Tab> {
  const tab = await openTab(browser, name, width, height, opts);
  await tab.page.goto(`/r/${code}`);
  await tab.page.getByPlaceholder("Your name").fill(name);
  const join = tab.page.getByRole("button", { name: "Join room" });
  await expect(join).toBeEnabled();
  await join.click();
  return tab;
}

export async function shot(tab: Tab, info: TestInfo, step: string): Promise<void> {
  await tab.page.screenshot({ path: info.outputPath(`${step}-${tab.label}.png`), fullPage: true });
}

/** No sideways scroll at this viewport. */
export async function expectFits(page: Page, where: string): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, `${where}: page is ${scroll}px wide in a ${inner}px viewport`).toBeLessThanOrEqual(inner);
}

export async function roomAddress(code: string): Promise<Address> {
  return pub.readContract({ address: stack().contracts.RoomFactory, abi: factoryAbi, functionName: "roomByCode", args: [code] });
}

/** name → { address, deposit still in the room, coins paid out to the account }, straight from the chain. */
export async function ledger(room: Address): Promise<Record<string, { address: Address; deposit: bigint; held: bigint }>> {
  const people = await pub.readContract({ address: room, abi: roomAbi, functionName: "getParticipants" });
  const out: Record<string, { address: Address; deposit: bigint; held: bigint }> = {};
  for (const address of people) {
    const [name, p, held] = await Promise.all([
      pub.readContract({ address: room, abi: roomAbi, functionName: "displayNames", args: [address] }),
      pub.readContract({ address: room, abi: roomAbi, functionName: "participants", args: [address] }),
      pub.readContract({ address: stack().contracts.KokoToken, abi: tokenAbi, functionName: "balanceOf", args: [address] }),
    ]);
    out[name] = { address, deposit: p[0], held };
  }
  return out;
}

/** The coin pill in a participant's header: deposit in the room plus coins already paid out. */
export const balancePill = (page: Page) => page.locator("header span.tabular-nums");

/** Host types a question, seals it, and opens it with the given timer. */
export async function sealAndOpen(host: Tab, text: string, options: string[], seconds: string): Promise<void> {
  await host.page.getByPlaceholder("Who wins tonight's final?").fill(text);
  for (let i = 0; i < options.length; i++) {
    if (i >= 2) await host.page.getByRole("button", { name: "+ option" }).click();
    await host.page.getByPlaceholder(`Option ${i + 1}`).fill(options[i]!);
  }
  const seal = host.page.getByRole("button", { name: "Seal question" });
  await expect(seal).toBeEnabled();
  await seal.click();
  const open = host.page.getByRole("button", { name: "Open question" });
  await expect(open).toBeEnabled({ timeout: 60_000 });
  await host.page.locator("select").first().selectOption(seconds);
  await open.click();
}

/** A participant taps an option and seals it. */
export async function pickAndLock(tab: Tab, option: string): Promise<void> {
  await tab.page.getByRole("button", { name: option }).click();
  const lock = tab.page.getByRole("button", { name: "Lock answer" });
  await expect(lock).toBeEnabled();
  await lock.click();
  await expect(tab.page.getByRole("heading", { name: "Your answer is sealed" })).toBeVisible();
}

/** The flying coins of the win animation, while they are in the air. */
export const flyingCoins = (page: Page) => page.locator("[data-coin-fly]");
/** Rows of the result list: one per person whose answer was opened. */
export const resultRows = (page: Page) => page.getByTestId("result-rows").locator("li");
