import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface LedgerEntry {
  /** Lowercased recipient. */
  address: string;
  kind: "drip" | "topup";
  wei: string;
  txHash: string;
  room: string;
  at: number;
}

interface LedgerFile {
  version: 1;
  /** Lowercased addresses that already received their one-time drip. */
  dripped: Record<string, { txHash: string; at: number; room: string }>;
  sends: LedgerEntry[];
}

export class LedgerCorruptError extends Error {}

/**
 * Durable record of what the operator wallet has sent.
 *
 * Fails closed: a file that exists but cannot be parsed throws instead of being read as empty,
 * because an empty ledger would re-drip every address and drain the operator wallet.
 * Writes go to a temp file and are renamed into place, so a crash leaves the old or new file,
 * never a torn one.
 */
export class Ledger {
  private data: LedgerFile;

  constructor(private readonly path: string) {
    this.data = Ledger.read(path);
  }

  private static read(path: string): LedgerFile {
    if (!existsSync(path)) return { version: 1, dripped: {}, sends: [] };
    const text = readFileSync(path, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new LedgerCorruptError(`drip ledger at ${path} is unreadable; refusing to start: ${String(err)}`);
    }
    const f = parsed as Partial<LedgerFile>;
    if (f?.version !== 1 || typeof f.dripped !== "object" || f.dripped === null || !Array.isArray(f.sends)) {
      throw new LedgerCorruptError(`drip ledger at ${path} has an unexpected shape; refusing to start`);
    }
    return f as LedgerFile;
  }

  hasDripped(address: string): boolean {
    return Object.hasOwn(this.data.dripped, address.toLowerCase());
  }

  /** Sum of everything sent at or after `sinceMs`. */
  sentSince(sinceMs: number): bigint {
    let total = 0n;
    for (const s of this.data.sends) if (s.at >= sinceMs) total += BigInt(s.wei);
    return total;
  }

  record(entry: LedgerEntry): void {
    const address = entry.address.toLowerCase();
    const next: LedgerFile = {
      version: 1,
      dripped:
        entry.kind === "drip"
          ? { ...this.data.dripped, [address]: { txHash: entry.txHash, at: entry.at, room: entry.room } }
          : this.data.dripped,
      sends: [...this.data.sends, { ...entry, address }],
    };
    this.persist(next);
    this.data = next;
  }

  private persist(next: LedgerFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2));
    renameSync(tmp, this.path);
  }
}
