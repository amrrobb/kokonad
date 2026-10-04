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
import { COIN, Status, balancePill, flyingCoins, resultRows, expectPlainLanguage, joinAs, ledger, openTab, hostCard, openQuestion, pickAndLock, prepareQuestions, pub, roomAbi, roomAddress, setResult, shot, stack, tokenAbi, type Tab } from "./helpers";

test.describe.configure({ mode: "serial" });

let host: Tab;
let sari: Tab;
let bimo: Tab;
let room: Address;

const OPTIONS = ["Heads", "Tails"];

const ROUNDS = ["Round one: heads or tails?", "Round two: heads or tails?", "Round three: heads or tails?"];

/** Host opens round n, both pick, answers open on their own, host sets the result. Leaves the round resolved. */
async function playRound(n: number, picks: { sari: string; bimo: string }, result: string) {
  const question = ROUNDS[n - 1]!;
  await openQuestion(host, n, "20");
  for (const t of [sari, bimo]) {
    await expect(t.page.getByRole("heading", { name: question })).toBeVisible();
    // Fresh screen every round: nothing carried over from the round before.
    await expect(t.page.getByRole("button", { name: "Lock answer" })).toBeDisabled();
    await expect(t.page.getByText("pot 2")).toBeVisible();
  }
  await pickAndLock(sari, picks.sari);
  // Sari has sealed, Bimo has not: Bimo's screen must give nothing away about her pick.
  expect(await bimo.page.innerText("body"), "the other player's screen while one answer is sealed").not.toContain("picked");
  await pickAndLock(bimo, picks.bimo);

  await expect(hostCard(host, n).getByText("2 of 2 answers open")).toBeVisible({ timeout: 60_000 });
  await setResult(host, n, result);
  await expect(hostCard(host, n).getByText(/right ·/)).toBeVisible();

  const q = await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [BigInt(n - 1)] });
  expect(q.status, `round ${n} status`).toBe(Status.RESOLVED);
  expect(q.options[Number(BigInt(q.outcome))], `round ${n} outcome`).toBe(result);
  expect(q.pot, `round ${n} pot`).toBe(2n * COIN);
}

/**
 * The pay-out for round n arrives without the host touching anything. Until it does, the chain
 * will not open the next question, so the host is not offered it.
 */
async function paidOut(n: number, paidTo: string) {
  if (n < ROUNDS.length) {
    await expect(hostCard(host, n + 1).getByRole("button", { name: `Open question ${n + 1}` })).toBeDisabled();
    await expect(hostCard(host, n + 1).getByText(`Question ${n} finishes first.`)).toBeVisible();
  }
  await expect(host.page.getByRole("button", { name: "Pay out" })).toHaveCount(0);
  await expect(hostCard(host, n).getByText(paidTo)).toBeVisible({ timeout: 120_000 });
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
  // The whole game is written and sealed once, up front.
  await prepareQuestions(host, ROUNDS.map((text) => ({ text, options: OPTIONS })));

  sari = await joinAs(browser, code, "Sari", 360, 780);
  bimo = await joinAs(browser, code, "Bimo", 360, 780, { reducedMotion: true }); // Bimo's phone asks for less motion
  for (const t of [sari, bimo]) await expect(balancePill(t.page)).toHaveText("20", { timeout: 60_000 });

  const l = await ledger(room);
  expect(l.Sari!.address).not.toBe(l.Bimo!.address);
  expect(l.Sari).toMatchObject({ deposit: 20n * COIN, held: 0n });
  expect(l.Bimo).toMatchObject({ deposit: 20n * COIN, held: 0n });
});

test("round 1: one is right, one is wrong, winner takes the pot", async ({}, info) => {
  await playRound(1, { sari: "Heads", bimo: "Tails" }, "Heads");

  await expect(sari.page.getByText("Nice one!")).toBeVisible();
  await expect(sari.page.getByTestId("result-amount")).toHaveText("+2");
  await expect(resultRows(bimo.page)).toHaveText([/^SASariHeads\+2$/, /^BIBimo \(you\)Tails$/]);
  await expect(sari.page.getByText("Heads was right. Pot of 2 split 1 way")).toBeVisible();
  await expect(bimo.page.getByText("Not this time")).toBeVisible();
  await expect(bimo.page.getByText("You picked Tails. Heads was right.")).toBeVisible();
  await shot(sari, info, "duel-1-win");
  await shot(bimo, info, "duel-1-lose");

  const l = await ledger(room);
  expect(await pub.readContract({ address: room, abi: roomAbi, functionName: "getWinners", args: [0n] })).toEqual([l.Sari!.address]);

  await paidOut(1, "Paid out to 1 person.");
  await expect(balancePill(sari.page)).toHaveText("21"); // 19 in the room + 2 won
  await expect(balancePill(bimo.page)).toHaveText("19");
});

test("round 2: both are right, the pot is split evenly", async ({}, info) => {
  await playRound(2, { sari: "Tails", bimo: "Tails" }, "Tails");

  for (const t of [sari, bimo]) {
    await expect(t.page.getByText("Nice one!")).toBeVisible();
    await expect(t.page.getByTestId("result-amount")).toHaveText("+1");
    await expect(t.page.getByText("Tails was right. Pot of 2 split 2 ways")).toBeVisible();
  }
  await shot(bimo, info, "duel-2-split");

  const winners = await pub.readContract({ address: room, abi: roomAbi, functionName: "getWinners", args: [1n] });
  const l = await ledger(room);
  expect([...winners].sort()).toEqual([l.Sari!.address, l.Bimo!.address].sort());

  // Both won. Sari's coins fly; Bimo asked for reduced motion, so his never do (his balance still updates).
  let bimoCoins = 0;
  const watch = setInterval(() => void flyingCoins(bimo.page).count().then((n) => (bimoCoins = Math.max(bimoCoins, n))).catch(() => {}), 100);
  const sariFlew = expect(flyingCoins(sari.page)).toHaveCount(10, { timeout: 120_000 });
  await paidOut(2, "Paid out to 2 people.");
  await sariFlew;
  clearInterval(watch);
  expect(bimoCoins, "coins seen flying on the reduced-motion phone").toBe(0);
  await expect(balancePill(sari.page)).toHaveText("21"); // 18 + 2 + 1
  await expect(balancePill(bimo.page)).toHaveText("19"); // 18 + 1
});

test("round 3: the decider goes to the same player", async () => {
  await playRound(3, { sari: "Heads", bimo: "Tails" }, "Heads");
  await expect(sari.page.getByText("Nice one!")).toBeVisible();
  await expect(bimo.page.getByText("Not this time")).toBeVisible();
  for (const t of [sari, bimo]) await expectPlainLanguage(t.page, `${t.label} round 3`);
});

test("pay-outs land and the final standings add up on the chain", async ({}, info) => {
  await paidOut(3, "Paid out to 1 person.");

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
