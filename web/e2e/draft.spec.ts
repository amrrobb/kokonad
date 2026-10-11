/**
 * The host asks for a first draft instead of typing every question. The model is stood in for by a
 * route stub (the suite never calls a paid API), so what is under test is the handoff: drafts land in
 * the unsealed list, the host can drop one, and sealing puts exactly the kept ones on the chain.
 */
import { expect, test } from "@playwright/test";
import { parseAbi } from "viem";
import { gotoAsGuest, openTab, pub, roomAddress, shot, type Tab } from "./helpers";

const questionCountAbi = parseAbi(["function questionCount() view returns (uint256)"]);
const DRAFTS = [
  { text: "Which lightning talk gets the loudest applause?", options: ["First", "Second", "Third"] },
  { text: "Will the demo work on the first try?", options: ["Yes", "No", "Second try"] },
  { text: "How many pizzas are left at 9 pm?", options: ["None", "1 to 3", "More than 3"] },
];

let host: Tab;
test.afterAll(async () => host?.page.context().close());

test("host drafts questions from a one-line brief, drops one, seals the rest", async ({ browser }, info) => {
  host = await openTab(browser, "host", 1280, 800);
  // Stand in for a configured relayer: the health check says drafting is on, and the drafting call answers with fixed questions.
  const asked: unknown[] = [];
  await host.page.route("**/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, drafting: true }) }));
  await host.page.route("**/questions", async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", questions: DRAFTS }) });
  });

  await gotoAsGuest(host.page, "/host");
  await host.page.getByLabel("People").fill("2");
  await host.page.getByRole("button", { name: "Create room" }).click();
  await host.page.waitForURL(/\/host\/[A-Z0-9]{6}$/, { timeout: 90_000 });
  const code = host.page.url().split("/").pop()!;

  const drafter = host.page.getByTestId("drafter");
  await expect(drafter).toBeVisible();
  // An empty brief is answered in words, not with a dead button, and no call leaves the page.
  await drafter.getByRole("button", { name: "Write them for me" }).click();
  await expect(drafter).toContainText("Say a few words about the event first");
  expect(asked).toEqual([]);
  await drafter.getByLabel("What is the event about?").fill("Jogja dev meetup, three lightning talks and pizza");
  await drafter.getByLabel("How many questions").selectOption("3");
  await drafter.getByLabel("Language").selectOption("Indonesian");
  await drafter.getByRole("button", { name: "Write them for me" }).click();

  const list = host.page.getByTestId("unsealed-list");
  await expect(list.locator("li")).toHaveCount(3);
  await expect(list).toContainText("Will the demo work on the first try?");
  expect(asked).toEqual([{ topic: "Jogja dev meetup, three lightning talks and pizza", count: 3, language: "Indonesian" }]);
  await shot(host, info, "1-drafts");

  // Nothing is sealed yet, and the host still decides: drop the pizza question.
  expect(await pub.readContract({ address: await roomAddress(code), abi: questionCountAbi, functionName: "questionCount" })).toBe(0n);
  await host.page.getByRole("button", { name: "Remove question 3" }).click();
  await expect(list.locator("li")).toHaveCount(2);

  // A seal that is refused (here: the relayer is down for one request) loses nothing: the drafts stay put.
  let refused = 0;
  await host.page.route("**/relay", (route) => {
    refused++;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ status: "refused", reason: "unavailable" }) });
  });
  await host.page.getByRole("button", { name: "Seal 2 questions" }).click();
  await expect.poll(() => refused).toBeGreaterThan(0);
  await expect(host.page.getByRole("button", { name: "Seal 2 questions" })).toBeEnabled();
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list).toContainText("Will the demo work on the first try?");
  expect(await pub.readContract({ address: await roomAddress(code), abi: questionCountAbi, functionName: "questionCount" })).toBe(0n);
  await host.page.unroute("**/relay");
  host.errors.length = 0; // the refused request is logged by the browser; that one is expected

  await host.page.getByRole("button", { name: "Seal 2 questions" }).click();

  await expect(host.page.getByTestId("question-1")).toContainText("Which lightning talk gets the loudest applause?");
  await expect(host.page.getByTestId("question-2")).toContainText("Will the demo work on the first try?");
  await expect(host.page.getByTestId("question-3")).toHaveCount(0);
  expect(await pub.readContract({ address: await roomAddress(code), abi: questionCountAbi, functionName: "questionCount" })).toBe(2n);
  await shot(host, info, "2-sealed");
  expect(host.errors).toEqual([]);
});

test("without a configured writer the host sees only the manual form", async ({ browser }) => {
  const tab = await openTab(browser, "host-plain", 1280, 800);
  await gotoAsGuest(tab.page, "/host");
  await tab.page.getByLabel("People").fill("2");
  await tab.page.getByRole("button", { name: "Create room" }).click();
  await tab.page.waitForURL(/\/host\/[A-Z0-9]{6}$/, { timeout: 90_000 });
  await expect(tab.page.getByRole("heading", { name: "Write your questions" })).toBeVisible();
  await expect(tab.page.getByTestId("drafter")).toHaveCount(0);
  await tab.page.context().close();
});
