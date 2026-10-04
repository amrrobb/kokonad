import { expect, test } from "@playwright/test";
import { expectFits, expectPlainLanguage, openTab } from "./helpers";

test("join: the button stays off until the code is complete, input is cleaned up", async ({ browser }) => {
  const tab = await openTab(browser, "join", 360, 780);
  await tab.page.goto("/join");
  const code = tab.page.getByLabel("Room code");
  const enter = tab.page.getByRole("button", { name: /Enter room/ });

  await expect(enter).toBeDisabled();
  await code.fill("ab-c2");
  await expect(code).toHaveValue("ABC2"); // upper-cased, punctuation dropped
  await expect(enter).toBeDisabled();
  await code.fill("abc234x9"); // capped at 6
  await expect(code).toHaveValue("ABC234");
  await expect(enter).toBeEnabled();
  await expectFits(tab.page, "join 360");
  await expectPlainLanguage(tab.page, "join");
});

test("join: a well-formed code nobody created says so in plain words", async ({ browser }) => {
  const tab = await openTab(browser, "join-unknown", 360, 780);
  await tab.page.goto("/join");
  await tab.page.getByLabel("Room code").fill("ZZZZ99");
  await tab.page.getByRole("button", { name: /Enter room/ }).click();
  await expect(tab.page).toHaveURL(/\/r\/ZZZZ99$/);
  await expect(tab.page.getByRole("heading", { name: "Room not found." })).toBeVisible();
  await expectPlainLanguage(tab.page, "room not found");

  await tab.page.getByRole("link", { name: "Try another code" }).click();
  await expect(tab.page).toHaveURL(/\/join$/);
});
