import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Ledger, LedgerCorruptError } from "../../src/ledger.js";

const dir = () => mkdtempSync(join(tmpdir(), "kokonad-ledger-"));
const entry = (address: string, at = 1000) => ({ address, kind: "drip" as const, wei: "100", txHash: "0x1", room: "0xroom", at });

describe("Ledger", () => {
  it("starts empty when no file exists", () => {
    const l = new Ledger(join(dir(), "l.json"));
    expect(l.hasDripped("0xabc")).toBe(false);
    expect(l.sentSince(0)).toBe(0n);
  });

  it("survives a reload and matches addresses case-insensitively", () => {
    const path = join(dir(), "nested", "l.json");
    new Ledger(path).record(entry("0xABCDEF"));
    const reloaded = new Ledger(path);
    expect(reloaded.hasDripped("0xabcdef")).toBe(true);
    expect(reloaded.hasDripped("0xABCDEF")).toBe(true);
  });

  it("leaves no temp file behind after a write", () => {
    const path = join(dir(), "l.json");
    new Ledger(path).record(entry("0x1"));
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8")).version).toBe(1);
  });

  it("refuses to load a torn file instead of reading it as empty (fails closed)", () => {
    const path = join(dir(), "l.json");
    new Ledger(path).record(entry("0x1"));
    const full = readFileSync(path, "utf8");
    writeFileSync(path, full.slice(0, Math.floor(full.length / 2)));
    expect(() => new Ledger(path)).toThrow(LedgerCorruptError);
  });

  it("refuses a file with an unexpected shape", () => {
    const path = join(dir(), "l.json");
    writeFileSync(path, JSON.stringify({ dripped: [] }));
    expect(() => new Ledger(path)).toThrow(LedgerCorruptError);
  });

  it("sums sends inside a time window only", () => {
    const l = new Ledger(join(dir(), "l.json"));
    l.record({ ...entry("0x1", 100), wei: "5" });
    l.record({ ...entry("0x2", 200), kind: "topup", wei: "7" });
    expect(l.sentSince(0)).toBe(12n);
    expect(l.sentSince(150)).toBe(7n);
  });

  it("does not mark a top-up recipient as dripped", () => {
    const l = new Ledger(join(dir(), "l.json"));
    l.record({ ...entry("0x9"), kind: "topup" });
    expect(l.hasDripped("0x9")).toBe(false);
  });
});
