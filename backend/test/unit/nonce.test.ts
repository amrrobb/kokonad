import { describe, expect, it } from "vitest";
import { NonceQueue } from "../../src/chain.js";

describe("NonceQueue", () => {
  it("hands out consecutive nonces to concurrent sends even when the RPC reports a stale count", async () => {
    const q = new NonceQueue(async () => 7); // a node that never sees our own transactions
    const used = await Promise.all([1, 2, 3].map(() => q.run(async (n) => n)));
    expect(used).toEqual([7, 8, 9]);
  });

  it("trusts a fetched count that is ahead of local state", async () => {
    let fetched = 3;
    const q = new NonceQueue(async () => fetched);
    expect(await q.run(async (n) => n)).toBe(3);
    fetched = 10; // another process used the operator key
    expect(await q.run(async (n) => n)).toBe(10);
  });

  it("does not burn a nonce when the send fails, and keeps serving later sends", async () => {
    const q = new NonceQueue(async () => 0);
    await expect(q.run(async () => { throw new Error("rejected"); })).rejects.toThrow("rejected");
    expect(await q.run(async (n) => n)).toBe(0);
    expect(await q.run(async (n) => n)).toBe(1);
  });

  it("runs sends one at a time", async () => {
    const q = new NonceQueue(async () => 0);
    let active = 0;
    let maxActive = 0;
    await Promise.all(
      [1, 2, 3].map(() =>
        q.run(async (n) => {
          active++;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
          return n;
        }),
      ),
    );
    expect(maxActive).toBe(1);
  });
});
