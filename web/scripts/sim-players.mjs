// Usage: node scripts/sim-players.mjs <CODE> [players=2] [base=https://kokonad.robbyn.xyz]   (HEADED=1 shows a window per player)
// Simulated players for a public room: each opens /r/<code> as a guest, joins with a "Sim" name, then
// answers every question the host opens by picking an option at random and locking it. Rooms, coins and
// results all stay on the chain; this only taps the screens a person would tap.
import { chromium } from "playwright";
const [code, nStr = "2", base = "https://kokonad.robbyn.xyz"] = process.argv.slice(2);
const names = ["Sim Ayu", "Sim Bagus", "Sim Citra", "Sim Dimas", "Sim Eka", "Sim Fajar", "Sim Gita", "Sim Hadi", "Sim Intan"];
const log = (who, msg) => console.log(new Date().toISOString().slice(11, 19), who, msg);
// HEADED=1 opens a real window per player so the people in the room can watch each phone.
const browser = await chromium.launch({ headless: !process.env.HEADED });
const bots = [];
for (let i = 0; i < Number(nStr); i++) {
  const name = names[i % names.length];
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log(name, "pageerror " + e));
  try {
    await page.goto(`${base}/r/${code}`);
    const guest = page.getByTestId("play-as-guest");
    if (await guest.isVisible({ timeout: 5000 }).catch(() => false)) await guest.click();
    await page.getByPlaceholder("Your name").fill(name);
    const join = page.getByRole("button", { name: "Join room" });
    await join.waitFor({ state: "visible", timeout: 20000 });
    await join.click();
    // Joined when the name field is gone and no refusal is shown.
    await Promise.race([
      page.getByPlaceholder("Your name").waitFor({ state: "detached", timeout: 90000 }),
      page.getByText(/room is full|no more room|can't join|couldn't/i).waitFor({ timeout: 90000 }).then(async () => { throw new Error(await page.locator("body").innerText()); }),
    ]);
    log(name, "joined");
    bots.push({ name, page, answered: new Set() });
  } catch (e) {
    log(name, "could not join: " + String(e).split("\n")[0]);
    await ctx.close();
  }
}
log("driver", `${bots.length} in room ${code}; answering until stopped`);
for (;;) {
  for (const b of bots) {
    try {
      const lock = b.page.getByRole("button", { name: "Lock answer" });
      if (!(await lock.isVisible().catch(() => false))) continue;
      const header = await b.page.locator("body").innerText();
      const qn = header.match(/Question (\d+)/)?.[1] ?? "?";
      if (b.answered.has(qn)) continue;
      const options = b.page.locator("button").filter({ hasNotText: /Lock answer|Disagree|Leave/ });
      const n = await options.count();
      if (n === 0) continue;
      const pick = options.nth(Math.floor(Math.random() * n));
      const label = (await pick.innerText()).trim();
      await pick.click();
      await lock.waitFor({ state: "visible" });
      if (!(await lock.isEnabled())) continue;
      await lock.click();
      await b.page.getByRole("heading", { name: "Your answer is sealed" }).waitFor({ timeout: 60000 });
      b.answered.add(qn);
      log(b.name, `question ${qn}: picked "${label}", sealed`);
    } catch (e) {
      log(b.name, "retrying: " + String(e).split("\n")[0]);
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
}
