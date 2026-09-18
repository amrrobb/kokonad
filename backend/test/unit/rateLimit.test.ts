import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "../../src/rateLimit.js";

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit inside the window, then refuses, then frees up as hits age out", () => {
    let now = 0;
    const l = new SlidingWindowLimiter(2, 1000, () => now);
    expect(l.tryTake("k")).toBe(true);
    now = 500;
    expect(l.tryTake("k")).toBe(true);
    expect(l.tryTake("k")).toBe(false);
    now = 1001; // first hit aged out
    expect(l.tryTake("k")).toBe(true);
    expect(l.tryTake("k")).toBe(false);
  });
  it("keeps keys independent", () => {
    const l = new SlidingWindowLimiter(1, 1000, () => 0);
    expect(l.tryTake("a")).toBe(true);
    expect(l.tryTake("b")).toBe(true);
    expect(l.tryTake("a")).toBe(false);
  });
  it("does not count refused attempts against the window", () => {
    let now = 0;
    const l = new SlidingWindowLimiter(1, 1000, () => now);
    l.tryTake("k");
    for (let i = 0; i < 10; i++) l.tryTake("k");
    now = 1001;
    expect(l.tryTake("k")).toBe(true);
  });
});
