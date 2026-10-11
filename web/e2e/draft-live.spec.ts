/**
 * The real question writer, on the deployed site: no stubs. Runs only against the public target with the
 * host's bypass key (E2E_DRAFT_KEY), because every call is a paid model call. Proves the whole handoff a
 * host sees: the drafter is offered, a brief becomes questions within the button's patience, and the kept
 * ones seal on the chain.
 */
import { expect, test } from "@playwright/test";
import { parseAbi } from "viem";
import { gotoAsGuest, openTab, pub, roomAddress, shot, type Tab } from "./helpers";
import { TARGET } from "./stack";

const questionCountAbi = parseAbi(["function questionCount() view returns (uint256)"]);
const KEY = process.env.E2E_DRAFT_KEY;

test.skip(TARGET !== "public" || !KEY, "needs E2E_TARGET=public and E2E_DRAFT_KEY");

let host: Tab;
test.afterAll(async () => host?.page.context().close());

test("the deployed writer turns a brief into questions the host can seal", async ({ browser }, info) => {
  host = await openTab(browser, "host-live", 1280, 800);
  await gotoAsGuest(host.page, `/host?draftkey=${KEY}`);
  await host.page.getByLabel("People").fill("2");
  await host.page.getByRole("button", { name: "Create room" }).click();
  await host.page.waitForURL(/\/host\/[A-Z0-9]{6}$/, { timeout: 90_000 });
  const code = host.page.url().split("/").pop()!;

  const drafter = host.page.getByTestId("drafter");
  await expect(drafter).toBeVisible();
  await drafter.getByLabel("What is the event about?").fill("Watch party of the badminton final, Indonesia vs Denmark, 25 people in a cafe");
  await drafter.getByLabel("How many questions").selectOption("3");
  await drafter.getByLabel("Language").selectOption("Indonesian");
  const started = Date.now();
  await drafter.getByRole("button", { name: "Write them for me" }).click();

  const list = host.page.getByTestId("unsealed-list");
  await expect(list.locator("li")).toHaveCount(3, { timeout: 120_000 });
  const seconds = Math.round((Date.now() - started) / 1000);
  await shot(host, info, "1-live-drafts");
  const texts = await list.locator("li").allInnerTexts();
  console.log(`[draft-live] ${seconds}s, room ${code}:\n` + texts.map((t) => "  " + t.replace(/\s+/g, " ")).join("\n"));
  for (const t of texts) expect(t.trim().length).toBeGreaterThan(5);
  // Rule 2 holds for machine-written copy too.
  expect(texts.join(" ")).not.toMatch(/\b(wallet|gas|transaction|crypto|bet|betting|gambl|token)/i);

  await host.page.getByRole("button", { name: "Remove question 3" }).click();
  await host.page.getByRole("button", { name: "Seal 2 questions" }).click();
  await expect(host.page.getByTestId("question-2")).toBeVisible({ timeout: 90_000 });
  expect(await pub.readContract({ address: await roomAddress(code), abi: questionCountAbi, functionName: "questionCount" })).toBe(2n);
  await shot(host, info, "2-live-sealed");
  expect(host.errors).toEqual([]);
});
