import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Ledger, LedgerCorruptError } from "../../src/ledger.js";

const dir = () => mkdtempSync(join(tmpdir(), "kokonad-ledger-"));
const spend = (at: number, wei = "100") => ({ signer: "0xAB", target: "0xCD", wei, txHash: "0x1", at });

describe("Ledger", () => {
  it("starts empty when no file exists", () => {
    expect(new Ledger(join(dir(), "l.json")).spentSince(0)).toBe(0n);
  });

  it("survives a reload", () => {
    const path = join(dir(), "nested", "l.json");
    new Ledger(path).record(spend(5, "42"));
    expect(new Ledger(path).spentSince(0)).toBe(42n);
  });

  it("leaves no temp file behind after a write", () => {
    const path = join(dir(), "l.json");
    new Ledger(path).record(spend(1));
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8")).version).toBe(2);
  });

  it("refuses to load a torn file instead of reading it as empty (fails closed)", () => {
    const path = join(dir(), "l.json");
    new Ledger(path).record(spend(1));
    const full = readFileSync(path, "utf8");
    writeFileSync(path, full.slice(0, Math.floor(full.length / 2)));
    expect(() => new Ledger(path)).toThrow(LedgerCorruptError);
  });

  it("refuses a file with an unexpected shape, including the old drip ledger", () => {
    const path = join(dir(), "l.json");
    writeFileSync(path, JSON.stringify({ version: 1, dripped: {}, sends: [] }));
    expect(() => new Ledger(path)).toThrow(LedgerCorruptError);
  });

  it("sums spends inside a time window only", () => {
    const l = new Ledger(join(dir(), "l.json"));
    l.record(spend(100, "5"));
    l.record(spend(200, "7"));
    expect(l.spentSince(0)).toBe(12n);
    expect(l.spentSince(150)).toBe(7n);
  });
});
