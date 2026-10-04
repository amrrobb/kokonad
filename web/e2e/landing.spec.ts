import { expect, test } from "@playwright/test";
import { expectFits, openTab } from "./helpers";

for (const [width, height] of [[360, 780], [1280, 800]] as const) {
  test(`landing at ${width}px: says what it is, fits, and leads to host and join`, async ({ browser }) => {
    const tab = await openTab(browser, `landing-${width}`, width, height);
    await tab.page.goto("/");
    await expect(tab.page.getByRole("heading", { level: 1 })).toContainText("Guess together.");
    await expectFits(tab.page, `landing ${width}`);

    await tab.page.getByRole("link", { name: /Create room/ }).click();
    await expect(tab.page).toHaveURL(/\/host$/);
    await expect(tab.page.getByRole("heading", { name: "Start a room" })).toBeVisible();

    await tab.page.goto("/");
    await tab.page.getByRole("link", { name: "Have a code? Join" }).click();
    await expect(tab.page).toHaveURL(/\/join$/);
    await expect(tab.page.getByLabel("Room code")).toBeVisible();

    expect(tab.errors, "console errors").toEqual([]);
    // Known today: the sign-in SDK is bundled into every page and fetches its catalogue on load even
    // with sign-in switched off. Anything else leaving the page is new and should be looked at.
    const unexpected = tab.outside.filter((u) => new URL(u).hostname !== "dynamic-static-assets.com");
    expect(unexpected, "requests to hosts the app is not known to call").toEqual([]);
  });
}
