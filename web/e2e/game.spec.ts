/**
 * One whole game, the way an event runs it: a host on a laptop, three people on phones.
 * Every account is made by the app in its own browser context; nobody holds MON; the relayer pays.
 *
 * Steps share one room, so they run in order and stop at the first failure.
 * Every money claim on a screen is checked against the chain read directly (helpers.ledger).
 */
import { expect, test } from "@playwright/test";
import { COIN, Status, balancePill, gotoAsGuest, flyingCoins, resultRows, expectFits, expectPlainLanguage, joinAs, ledger, openTab, hostCard, openQuestion, pickAndLock, prepareQuestions, pub, roomAbi, roomAddress, setResult, shot, stack, tokenAbi, type Tab } from "./helpers";
import { parseAbi, type Address } from "viem";

test.describe.configure({ mode: "serial" });

let host: Tab;
let eka: Tab; // phone, will be right
let fajar: Tab; // laptop-width, will be wrong
let gita: Tab; // phone, sits the first question out
let big: Tab; // the projector: the room's view, no controls, no account
const mood = (t: Tab) => t.page.getByTestId("mascot").first();
let code: string;
let room: Address;

test.afterAll(async () => {
  for (const t of [host, eka, fajar, gita, big]) await t?.page.context().close();
});

test("host creates a sponsored room for three people", async ({ browser }, info) => {
  host = await openTab(browser, "host", 1280, 800);
  await gotoAsGuest(host.page, "/host");
  await host.page.getByLabel("People").fill("3");
  await expect(host.page.getByText("Budget: 60 coins")).toBeVisible();
  const create = host.page.getByRole("button", { name: "Create room" });
  await expect(create).toBeEnabled();
  await create.click();
  await host.page.waitForURL(/\/host\/[A-Z0-9]{6}$/, { timeout: 90_000 });
  code = host.page.url().split("/").pop()!;
  await expect(host.page.getByRole("heading", { name: "Write your questions" })).toBeVisible();
  // The top of the screen says what to do next, and the picture to scan leads to this room and nowhere else.
  await expect(host.page.getByTestId("stage")).toContainText("Write tonight's questions.");
  await expect(host.page.getByTestId("join-qr")).toHaveAttribute("data-url", new RegExp(`^http://localhost:\\d+/r/${code}$`));

  // The host writes the whole game up front and seals it in one go, before anyone has joined.
  await prepareQuestions(host, [
    { text: "Who wins tonight's final?", options: ["Team Kopi", "Team Sate", "Team Gudeg"] },
    { text: "How many people showed up?", options: ["Under 20", "20 to 40", "Over 40"] },
  ]);
  expect(await pub.readContract({ address: await roomAddress(code), abi: parseAbi(["function questionCount() view returns (uint256)"]), functionName: "questionCount" })).toBe(2n);
  // Only the next question can be opened, and not into an empty room.
  await expect(hostCard(host, 1).getByRole("button", { name: "Open question 1" })).toBeDisabled();
  await expect(hostCard(host, 1).getByText("Wait for someone to join.")).toBeVisible();
  await expect(hostCard(host, 2).getByText("Up next after question 1.")).toBeVisible();
  await expect(hostCard(host, 2).getByRole("button", { name: /Open question/ })).toHaveCount(0);
  await expect(host.page.getByTestId("stage")).toContainText("Waiting for players.");
  // With questions sealed the writing form folds away, so the game keeps the screen.
  await expect(host.page.getByRole("button", { name: "Write more questions" })).toBeVisible();
  await expect(host.page.getByRole("heading", { name: "Write your questions" })).toHaveCount(0);
  await expect(host.page.locator("aside").getByText("In the room")).toContainText("0 of 3"); // budget 60 / deposit 20
  await shot(host, info, "1-room");
  // Every screen carries the mark, and the host's coconut is asleep while the room is empty.
  await expect(host.page.getByTestId("logo")).toBeVisible();
  await expect(host.page.getByTestId("stage").getByTestId("mascot")).toHaveAttribute("data-mood", "sleepy");

  // The big screen needs no account: it shows the code, a picture to scan that leads to this room, and nobody yet.
  big = await openTab(browser, "big-screen", 1280, 720);
  await big.page.goto(`/host/${code}/screen`);
  await expect(big.page.getByTestId("screen-code")).toHaveText(code);
  await expect(big.page.getByTestId("screen-qr")).toHaveAttribute("data-url", new RegExp(`^http://localhost:\\d+/r/${code}$`));
  await expect(big.page.getByTestId("screen-count")).toHaveText("0 in the room");
  await expect(big.page.getByRole("button")).toHaveCount(0); // nothing to press
  await expectFits(big.page, "big screen waiting");
  await shot(big, info, "1-waiting");

  // The code on the screen is the code the chain knows, and the budget is really there.
  room = await roomAddress(code);
  expect(await pub.readContract({ address: room, abi: roomAbi, functionName: "budget" })).toBe(60n * COIN);
  expect(await pub.readContract({ address: stack().contracts.KokoToken, abi: tokenAbi, functionName: "balanceOf", args: [room] })).toBe(60n * COIN);
});

test("a tab that did not create the room cannot run it", async ({ browser }) => {
  const stranger = await openTab(browser, "stranger", 1280, 800);
  await gotoAsGuest(stranger.page, `/host/${code}`);
  await expect(stranger.page.getByRole("heading", { name: "This room is hosted from another tab." })).toBeVisible();
  await expect(stranger.page.getByRole("button", { name: /Seal|Open question/ })).toHaveCount(0);
  await stranger.page.context().close();
});

test("three people join from their own devices and get their coins", async ({ browser }, info) => {
  eka = await joinAs(browser, code, "Eka", 360, 780);
  fajar = await joinAs(browser, code, "Fajar", 1280, 800);
  gita = await joinAs(browser, code, "Gita", 360, 780);
  for (const t of [eka, fajar, gita]) {
    await expect(t.page.getByText("20 coins in your balance")).toBeVisible({ timeout: 60_000 });
    await expect(balancePill(t.page)).toHaveText("20");
    await expectPlainLanguage(t.page, `${t.label} lobby`);
  }
  await expect(eka.page.getByRole("heading", { name: "Hi, Eka." })).toBeVisible();
  await expect(eka.page.getByText("In the room (3)")).toBeVisible();
  await expectFits(eka.page, "lobby 360");
  await expect(eka.page.getByTestId("logo")).toBeVisible();
  await expect(mood(eka)).toHaveAttribute("data-mood", "sleepy"); // waiting for the host
  await shot(eka, info, "2-lobby");
  await expect(big.page.getByTestId("screen-count")).toHaveText("3 in the room");
  await expectPlainLanguage(big.page, "big screen waiting");
  await shot(big, info, "2-three-joined");

  // Host sees all three, and the budget is spent.
  // (an avatar with the initials sits in the same row, so match the row, not the exact text)
  await expect(host.page.locator("aside ul li")).toHaveText([/Eka\s*20$/, /Fajar\s*20$/, /Gita\s*20$/]);
  await expect(host.page.locator("aside").getByText("Budget left")).toContainText("0");

  const l = await ledger(room);
  expect(Object.keys(l).sort()).toEqual(["Eka", "Fajar", "Gita"]);
  for (const p of Object.values(l)) expect(p).toMatchObject({ deposit: 20n * COIN, held: 0n });
  expect(await pub.readContract({ address: room, abi: roomAbi, functionName: "budget" })).toBe(0n);
  // Three different people really are three different accounts.
  expect(new Set(Object.values(l).map((p) => p.address)).size).toBe(3);
});

test("a fourth person is told plainly that the room has no coins left for them", async ({ browser }) => {
  const hadi = await joinAs(browser, code, "Hadi", 360, 780);
  await expect(hadi.page.getByRole("heading", { name: "Something didn't go through." })).toBeVisible({ timeout: 60_000 });
  await expect(hadi.page.getByText("The host hasn't added coins yet. Ask your host.")).toBeVisible();
  await expect(hadi.page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expectPlainLanguage(hadi.page, "join refused");
  expect(Object.keys(await ledger(room))).not.toContain("Hadi");
  await hadi.page.context().close();
});

test("question 1: answers stay sealed, open on their own, and the right person is paid", async ({}, info) => {
  await openQuestion(host, 1, "20");

  for (const t of [eka, fajar, gita]) {
    await expect(t.page.getByRole("heading", { name: "Who wins tonight's final?" })).toBeVisible();
    await expect(balancePill(t.page)).toHaveText("19"); // one play went into the pot
  }
  await expect(eka.page.getByText("pot 3")).toBeVisible();
  // The pictures agree with the figures: three coins in the bowl, nobody sealed yet, a clock running.
  await expect(eka.page.getByTestId("pot-bowl")).toHaveAttribute("data-coins", "3");
  await expect(eka.page.getByTestId("answer-dots")).toHaveAttribute("data-answered", "0");
  await expect(eka.page.getByTestId("timer")).toBeVisible();
  await expectFits(eka.page, "question 360");
  await shot(eka, info, "3-question");
  // The room reads the question and the clock off the big screen; it never shows who picked what.
  await expect(big.page.getByRole("heading", { name: "Who wins tonight's final?" })).toBeVisible();
  await expect(big.page.getByTestId("screen-clock")).toBeVisible();
  await expectFits(big.page, "big screen live");
  await shot(big, info, "3-live");

  await pickAndLock(eka, "Team Sate");
  await pickAndLock(fajar, "Team Kopi");
  await expectPlainLanguage(eka.page, "sealed");
  await expect(host.page.getByText("2 of 3 answered")).toBeVisible();
  await expect(big.page.getByText("2 of 3 sealed")).toBeVisible();
  await expectPlainLanguage(big.page, "big screen live");
  await expect(fajar.page.getByTestId("answer-dots")).toHaveAttribute("data-answered", "2"); // dots, never choices
  await expect(host.page.getByTestId("stage").getByTestId("answer-dots")).toHaveAttribute("data-answered", "2");
  // The host's 3D pot holds the chain's pot. Where the browser can draw it, the drawing surface must be
  // exactly the box times the pixel ratio: anything else is a picture squeezed into a corner.
  const scene = host.page.getByTestId("pot-scene");
  await expect(scene).toHaveAttribute("data-coins", "3");
  // On a 1280x800 laptop the pot and the live question are on screen together: nobody scrolls to follow the game.
  await expect(scene).toBeInViewport({ ratio: 1 });
  await expect(hostCard(host, 1)).toBeInViewport({ ratio: 1 });
  const surface = await scene.evaluate((el) => {
    const c = el.querySelector("canvas");
    return { mode: el.getAttribute("data-mode"), ok: !c || (c.width === Math.round(el.clientWidth * Math.min(devicePixelRatio, 2)) && c.height === Math.round(el.clientHeight * Math.min(devicePixelRatio, 2)) && c.width > 0) };
  });
  expect(surface.ok, `pot scene surface (${surface.mode})`).toBe(true);

  // While the question is live the chain holds only commitments: no answer is readable yet.
  const live = await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [0n] });
  expect(live.status).toBe(Status.OPEN);
  expect(live.revealed).toBe(0);

  // Time runs out. Gita never answered; the two sealed answers open without anyone touching anything.
  await expect(gita.page.getByRole("heading", { name: "Time's up. Your 1 coin stayed in the pot." })).toBeVisible({ timeout: 40_000 });
  await expect(host.page.getByText("2 of 2 answers open")).toBeVisible({ timeout: 60_000 });
  await expect(eka.page.getByRole("heading", { name: "Everyone's answers are open" })).toBeVisible();
  await expect(mood(gita)).toHaveAttribute("data-mood", "sleepy"); // sat it out
  await shot(gita, info, "4-sat-out");
  await shot(eka, info, "4-answers-open");
  await shot(host, info, "4-answers-open");
  await expect(big.page.getByRole("heading", { name: "Time's up!" })).toBeVisible();
  await shot(big, info, "4-times-up");

  // The host sees how the opened answers split, picks one, and can back out before confirming.
  const card = hostCard(host, 1);
  await expect(card.getByRole("button", { name: /^Team/ })).toHaveText([/Team Kopi\s*1 answer$/, /Team Sate\s*1 answer$/, /Team Gudeg\s*0 answers$/]);
  await card.getByRole("button", { name: /^Team Kopi/ }).click();
  await card.getByRole("button", { name: "Back" }).click();
  await expect(card.getByRole("alertdialog")).toHaveCount(0);
  expect((await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [0n] })).status, "backing out sets nothing").not.toBe(Status.RESOLVED);
  await setResult(host, 1, "Team Sate");

  await expect(eka.page.getByText("Nice one!")).toBeVisible();
  await expect(eka.page.getByTestId("result-amount")).toHaveText("+3");
  await expect(eka.page.getByText("Team Sate was right. Pot of 3 split 1 way, arriving when the result is final.")).toBeVisible();
  await expect(fajar.page.getByText("Not this time")).toBeVisible();
  await expect(fajar.page.getByText("You picked Team Kopi. Team Sate was right. Your play went to the pot.")).toBeVisible();
  await expect(gita.page.getByText("You sat this one out. Team Sate was right. Your play went to the pot.")).toBeVisible();
  await expect(fajar.page.getByTestId("result-amount")).toHaveText("−1");
  // Everyone sees the same list: winners first with what they won, then the rest; the reader is marked.
  // Gita never answered, so she is not in it.
  await expect(resultRows(eka.page)).toHaveText([/^EKEka \(you\)Team Sate\+3$/, /^FAFajarTeam Kopi$/]);
  await expect(resultRows(fajar.page)).toHaveText([/^EKEkaTeam Sate\+3$/, /^FAFajar \(you\)Team Kopi$/]);
  await expect(resultRows(gita.page)).toHaveText([/^EKEkaTeam Sate\+3$/, /^FAFajarTeam Kopi$/]);
  await expectFits(eka.page, "result 360");
  // The coconut is happy for the winner and sorry for the loser; the big screen says which answer was right and what the pot was.
  await expect(mood(eka)).toHaveAttribute("data-mood", "happy");
  await expect(mood(fajar)).toHaveAttribute("data-mood", "oops");
  await expect(big.page.getByTestId("screen-pot")).toHaveText("3");
  await expect(big.page.getByText("going to 1 winner")).toBeVisible();
  await expectPlainLanguage(big.page, "big screen result");
  await shot(big, info, "5-result");
  // Nothing flies yet: the coins have not moved on the chain.
  await expect(flyingCoins(eka.page)).toHaveCount(0);
  for (const t of [eka, fajar, gita]) await expectPlainLanguage(t.page, `${t.label} result`);
  await shot(eka, info, "5-win");
  await shot(fajar, info, "5-lose");

  // Regression (18 Sep): a loser's screen briefly named the wrong answer when reads came from two blocks.
  let wrong = 0;
  for (const until = Date.now() + 6_000; Date.now() < until; ) {
    if ((await fajar.page.innerText("body")).includes("Team Kopi was right")) wrong++;
    await fajar.page.waitForTimeout(250);
  }
  expect(wrong, "samples of the loser's screen naming the wrong answer").toBe(0);

  // The result can still be disputed: nothing has moved yet, and the next question waits its turn.
  await expect(card.getByText(/pays out on its own in \d+ s unless people disagree/)).toBeVisible();
  expect((await ledger(room)).Eka!.held).toBe(0n);
  await expect(hostCard(host, 2).getByRole("button", { name: "Open question 2" })).toBeDisabled();
  await expect(hostCard(host, 2).getByText("Question 1 finishes first.")).toBeVisible();

  // The host does nothing more: the pay-out is sent on its own once the window has passed.
  // The one animated moment: ten coins fly to the winner's balance when the pay-out lands. Nobody else gets it.
  await expect(flyingCoins(eka.page)).toHaveCount(10, { timeout: 120_000 });
  await eka.page.waitForTimeout(350);
  await shot(eka, info, "6-coins-flying");
  expect(await flyingCoins(fajar.page).count()).toBe(0);
  await expect(flyingCoins(eka.page)).toHaveCount(0); // and they clean up after themselves
  await expect(host.page.getByText("Paid out to 1 person.")).toBeVisible();
  await expect(eka.page.getByText("in your balance now.")).toBeVisible();
  await expect(balancePill(eka.page)).toHaveText("22");
  await expect(balancePill(fajar.page)).toHaveText("19");
  await expect(balancePill(gita.page)).toHaveText("19");
  // The host's standings are the same figures, winner on top.
  await expect(host.page.getByTestId("standings").locator("li")).toHaveText([/Eka\s*22$/, /Fajar\s*19$/, /Gita\s*19$/]);
  await shot(eka, info, "6-paid");
  await shot(host, info, "6-paid");
  // Once the result has had its moment, the big screen shows who is ahead: the same figures as the chain.
  await expect(big.page.getByTestId("screen-standings").locator("li")).toHaveText([/Eka\s*22$/, /Fajar\s*19$/, /Gita\s*19$/], { timeout: 40_000 });
  await expectFits(big.page, "big screen standings");
  await shot(big, info, "6-standings");

  // The chain agrees with every screen.
  const q = await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [0n] });
  expect(q.status).toBe(Status.SETTLED);
  expect(q.options[Number(BigInt(q.outcome))]).toBe("Team Sate");
  const l = await ledger(room);
  expect(await pub.readContract({ address: room, abi: roomAbi, functionName: "getWinners", args: [0n] })).toEqual([l.Eka!.address]);
  expect(l.Eka).toMatchObject({ deposit: 19n * COIN, held: 3n * COIN });
  expect(l.Fajar).toMatchObject({ deposit: 19n * COIN, held: 0n });
  expect(l.Gita).toMatchObject({ deposit: 19n * COIN, held: 0n });
  // Conservation: every coin the host put in is either still in the room or in a player's account.
  const inRoom = await pub.readContract({ address: stack().contracts.KokoToken, abi: tokenAbi, functionName: "balanceOf", args: [room] });
  expect(inRoom + l.Eka!.held + l.Fajar!.held + l.Gita!.held).toBe(60n * COIN);
  expect(inRoom).toBe(57n * COIN);
});

test("question 2: nobody is right, the question is cancelled and every play goes back", async ({}, info) => {
  await openQuestion(host, 2, "20");
  for (const t of [eka, fajar, gita]) await expect(t.page.getByRole("heading", { name: "How many people showed up?" })).toBeVisible();
  await expect(balancePill(fajar.page)).toHaveText("18");

  // A new question starts clean: nothing is pre-selected from the one before.
  for (const t of [eka, fajar]) await expect(t.page.getByRole("button", { name: "Lock answer" })).toBeDisabled();

  await pickAndLock(eka, "Under 20");
  await pickAndLock(fajar, "Under 20");
  await pickAndLock(gita, "20 to 40");
  // Regression (3 Oct): players who had opened an answer in question 1 never opened one again.
  await expect(host.page.getByText("3 of 3 answers open")).toBeVisible({ timeout: 60_000 });

  await setResult(host, 2, "Over 40");

  await expect(host.page.getByText("Cancelled. Everyone's play went back.")).toBeVisible();
  for (const t of [eka, fajar, gita]) {
    await expect(t.page.getByRole("heading", { name: "This question was cancelled." })).toBeVisible();
    await expectPlainLanguage(t.page, `${t.label} cancelled`);
  }
  await expect(balancePill(eka.page)).toHaveText("22");
  await expect(balancePill(fajar.page)).toHaveText("19");
  await shot(fajar, info, "7-cancelled");

  const q = await pub.readContract({ address: room, abi: roomAbi, functionName: "getQuestion", args: [1n] });
  expect(q.status).toBe(Status.VOIDED);
  const l = await ledger(room);
  for (const name of ["Eka", "Fajar", "Gita"]) expect(l[name]!.deposit, `${name} deposit after the refund`).toBe(19n * COIN);
  const inRoom = await pub.readContract({ address: stack().contracts.KokoToken, abi: tokenAbi, functionName: "balanceOf", args: [room] });
  expect(inRoom).toBe(57n * COIN);
});

test("nothing broke quietly on any screen", async () => {
  // Allowed: the relayer answering 422 "not yet". A phone asks to open its answer the instant its own
  // clock says time is up; the chain's newest block is a moment behind, so the first ask can be refused
  // and the app asks again on its next poll. The browser logs each refusal. Anything else is a failure.
  const notYet = /status of 422/;
  for (const t of [host, eka, fajar, gita]) {
    expect(t.errors.filter((e) => !notYet.test(e)), `${t.label} console errors`).toEqual([]);
    expect(t.errors.length, `${t.label}: "not yet" refusals should stay a handful, not a retry storm`).toBeLessThanOrEqual(6);
  }
});
