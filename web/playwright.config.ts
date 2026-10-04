import { defineConfig } from "@playwright/test";
import { WEB_URL } from "./e2e/stack";

/**
 * End-to-end suite. Hermetic: a local chain (anvil, chain id 10143) running the real compiled
 * contracts, the real relayer, and a production build of this app. Nothing touches Monad testnet
 * and no real key is loaded. See e2e/README.md.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One game is one shared chain story; run files one after another.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 8 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
