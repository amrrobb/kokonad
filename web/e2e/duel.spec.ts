/**
 * Two accounts compete head to head in one room over three rounds:
 *
 *   round 1  Sari right, Bimo wrong   → Sari takes the whole pot
 *   round 2  both right               → the pot is split evenly
 *   round 3  Sari right, Bimo wrong   → Sari takes the pot again
 *
 * Each account is the one the app made for that browser context. After every round the two screens
 * are checked against each other and against the chain; at the end the standings must add up.
 */
import { expect, test } from "@playwright/test";
import type { Address } from "viem";
import { COIN, Status, balancePill, expectPlainLanguage, joinAs, ledger, openTab, pickAndLock, pub, roomAbi, roomAddress, sealAndOpen, shot, stack, tokenAbi, type Tab } from "./helpers";

test.describe.configure({ mode: "serial" });

let host: Tab;
let sari: Tab;
let bimo: Tab;
let room: Address;

const OPTIONS = ["Heads", "Tails"];

/** Opens a round, both pick, answers open on their own, host sets the result. Leaves the round resolved. */
async function playRound(n: number, question: string, picks: { sari: string; bimo: string }, result: string) {
  if (n === 1) await sealAndOpen(host, question, OPTIONS, "20");
  else await openSealed();
  for (const t of [sari, bimo]) {
    await expect(t.page.getByRole("heading", { name: question })).toBeVisible();
    // Fresh screen every round: nothing carried over from the round before.
    await expect(t.page.getByRole("button", { name: "Lock answer" })).toBeDisabled();
    await expect(t.page.getByText("pot 2")).toBeVisible();
  }
  await pickAndLock(sari, picks.sari);
  // Sari has sealed, Bimo has not: Bimo's screen must give nothing away about her pick.
  const bimoSees = await bimo.page.innerText("body");
  expect(bimoSees, "the other player's screen while one answer is sealed").not.toContain("picked");
  await pickAndLock(bimo, picks.bimo);

  const card = host.page.locator("main ul > li").filter({ hasText: question });
  await expect(card.getByText("2 of 2 answers open")).toBeVisible({ timeout: 60_000 });
  const button = card.getByRole("button", { name: result, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(card.getByText(/right ·/)).toBeVisible();

  const q = await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [BigInt(n - 1)] });
  expect(q.status, `round ${n} status`).toBe(Status.RESOLVED);
  expect(q.options[Number(BigInt(q.outcome))], `round ${n} outcome`).toBe(result);
  expect(q.pot, `round ${n} pot`).toBe(2n * COIN);
}

/**
 * Waits out the dispute window for one round and pays it. While it waits, checks the rule the chain
 * enforces: the next question cannot be opened until this one is paid, so the host is not offered it.
 */
async function payOut(question: string, paidTo: string, next?: { question: string }) {
  if (next) {
    await host.page.getByPlaceholder("Who wins tonight's final?").fill(next.question);
    await host.page.getByPlaceholder("Option 1").fill(OPTIONS[0]!);
    await host.page.getByPlaceholder("Option 2").fill(OPTIONS[1]!);
    await host.page.getByRole("button", { name: "Seal question" }).click();
    const open = host.page.getByRole("button", { name: "Open question" });
    await expect(open).toBeVisible({ timeout: 60_000 });
    await expect(open).toBeDisabled();
    await expect(host.page.getByText("Pay out the current question first.")).toBeVisible();
  }
  const card = host.page.locator("main ul > li").filter({ hasText: question });
  const pay = card.getByRole("button", { name: "Pay out" });
  await expect(pay).toBeEnabled({ timeout: 90_000 });
  await pay.click();
  await expect(card.getByText(paidTo)).toBeVisible();
}

/** Opens a question that was sealed earlier (see payOut). */
async function openSealed() {
  const open = host.page.getByRole("button", { name: "Open question" });
  await expect(open).toBeEnabled();
  await host.page.locator("select").first().selectOption("20");
  await open.click();
}

test.afterAll(async () => {
  for (const t of [host, sari, bimo]) await t?.page.context().close();
});

test("two accounts join the same room and start level", async ({ browser }) => {
  host = await openTab(browser, "duel-host", 1280, 800);
  await host.page.goto("/host");
  await host.page.getByLabel("People").fill("2");
  await host.page.getByRole("button", { name: "Create room" }).click();
  await host.page.waitForURL(/\/host\/[A-Z0-9]{6}$/, { timeout: 90_000 });
  const code = host.page.url().split("/").pop()!;
  room = await roomAddress(code);

  sari = await joinAs(browser, code, "Sari", 360, 780);
  bimo = await joinAs(browser, code, "Bimo", 360, 780);
  for (const t of [sari, bimo]) await expect(balancePill(t.page)).toHaveText("20", { timeout: 60_000 });

  const l = await ledger(room);
  expect(l.Sari!.address).not.toBe(l.Bimo!.address);
  expect(l.Sari).toMatchObject({ deposit: 20n * COIN, held: 0n });
  expect(l.Bimo).toMatchObject({ deposit: 20n * COIN, held: 0n });
});

test("round 1: one is right, one is wrong, winner takes the pot", async ({}, info) => {
  await playRound(1, "Round one: heads or tails?", { sari: "Heads", bimo: "Tails" }, "Heads");

  await expect(sari.page.getByText("Nice one!")).toBeVisible();
  await expect(sari.page.getByText("+2", { exact: true })).toBeVisible();
  await expect(sari.page.getByText("Heads was right. Pot of 2 split 1 way")).toBeVisible();
  await expect(bimo.page.getByText("Not this time")).toBeVisible();
  await expect(bimo.page.getByText("You picked Tails. Heads was right.")).toBeVisible();
  await shot(sari, info, "duel-1-win");
  await shot(bimo, info, "duel-1-lose");

  const l = await ledger(room);
  expect(await pub.readContract({ address: room, abi: roomAbi, functionName: "getWinners", args: [0n] })).toEqual([l.Sari!.address]);

  await payOut("Round one: heads or tails?", "Paid out to 1 person.", { question: "Round two: heads or tails?" });
  await expect(balancePill(sari.page)).toHaveText("21"); // 19 in the room + 2 won
  await expect(balancePill(bimo.page)).toHaveText("19");
});

test("round 2: both are right, the pot is split evenly", async ({}, info) => {
  await playRound(2, "Round two: heads or tails?", { sari: "Tails", bimo: "Tails" }, "Tails");

  for (const t of [sari, bimo]) {
    await expect(t.page.getByText("Nice one!")).toBeVisible();
    await expect(t.page.getByText("+1", { exact: true })).toBeVisible();
    await expect(t.page.getByText("Tails was right. Pot of 2 split 2 ways")).toBeVisible();
  }
  await shot(bimo, info, "duel-2-split");

  const winners = await pub.readContract({ address: room, abi: roomAbi, functionName: "getWinners", args: [1n] });
  const l = await ledger(room);
  expect([...winners].sort()).toEqual([l.Sari!.address, l.Bimo!.address].sort());

  await payOut("Round two: heads or tails?", "Paid out to 2 people.", { question: "Round three: heads or tails?" });
  await expect(balancePill(sari.page)).toHaveText("21"); // 18 + 2 + 1
  await expect(balancePill(bimo.page)).toHaveText("19"); // 18 + 1
});

test("round 3: the decider goes to the same player", async () => {
  await playRound(3, "Round three: heads or tails?", { sari: "Heads", bimo: "Tails" }, "Heads");
  await expect(sari.page.getByText("Nice one!")).toBeVisible();
  await expect(bimo.page.getByText("Not this time")).toBeVisible();
  for (const t of [sari, bimo]) await expectPlainLanguage(t.page, `${t.label} round 3`);
});

test("pay-outs land and the final standings add up on the chain", async ({}, info) => {
  await payOut("Round three: heads or tails?", "Paid out to 1 person.");

  // Each paid 3 plays (20 → 17 in the room). Sari won 2 + 1 + 2, Bimo won 1.
  await expect(balancePill(sari.page)).toHaveText("22");
  await expect(balancePill(bimo.page)).toHaveText("18");
  await shot(sari, info, "duel-final");
  await shot(bimo, info, "duel-final");
  await shot(host, info, "duel-final");

  const l = await ledger(room);
  expect(l.Sari).toMatchObject({ deposit: 17n * COIN, held: 5n * COIN });
  expect(l.Bimo).toMatchObject({ deposit: 17n * COIN, held: 1n * COIN });
  for (const id of [0n, 1n, 2n]) {
    const q = await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [id] });
    expect(q.status, `round ${id + 1n} settled`).toBe(Status.SETTLED);
  }
  // Zero-sum between the two: what one gained the other lost, and no coin appeared or vanished.
  const total = (p: { deposit: bigint; held: bigint }) => p.deposit + p.held;
  expect(total(l.Sari!) - 20n * COIN).toBe(-(total(l.Bimo!) - 20n * COIN));
  const inRoom = await pub.readContract({ address: stack().contracts.KokoToken, abi: tokenAbi, functionName: "balanceOf", args: [room] });
  expect(inRoom + l.Sari!.held + l.Bimo!.held).toBe(40n * COIN);

  for (const t of [host, sari, bimo]) expect(t.errors.filter((e) => !/status of 422/.test(e)), `${t.label} console errors`).toEqual([]);
});
