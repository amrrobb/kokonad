import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface SpendEntry {
  /** Lowercased signer the relayer paid gas for. */
  signer: string;
  target: string;
  /** Upper bound actually charged on Monad: gas limit x effective gas price. */
  wei: string;
  txHash: string;
  at: number;
}

interface LedgerFile {
  version: 2;
  spends: SpendEntry[];
}

export class LedgerCorruptError extends Error {}

/**
 * Durable record of the gas the relayer has paid, used for the daily cap.
 *
 * Fails closed: a file that exists but cannot be parsed throws instead of being read as empty, because an
 * empty ledger would reset the daily cap. Writes go to a temp file and are renamed into place, so a crash
 * leaves the old or the new file, never a torn one.
 */
export class Ledger {
  private data: LedgerFile;

  constructor(private readonly path: string) {
    this.data = Ledger.read(path);
  }

  private static read(path: string): LedgerFile {
    if (!existsSync(path)) return { version: 2, spends: [] };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new LedgerCorruptError(`relay ledger at ${path} is unreadable; refusing to start: ${String(err)}`);
    }
    const f = parsed as Partial<LedgerFile>;
    if (f?.version !== 2 || !Array.isArray(f.spends)) {
      throw new LedgerCorruptError(`relay ledger at ${path} has an unexpected shape; refusing to start`);
    }
    return f as LedgerFile;
  }

  /** Sum of gas paid at or after `sinceMs`. */
  spentSince(sinceMs: number): bigint {
    let total = 0n;
    for (const s of this.data.spends) if (s.at >= sinceMs) total += BigInt(s.wei);
    return total;
  }

  record(entry: SpendEntry): void {
    const next: LedgerFile = {
      version: 2,
      spends: [...this.data.spends, { ...entry, signer: entry.signer.toLowerCase(), target: entry.target.toLowerCase() }],
    };
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2));
    renameSync(tmp, this.path);
    this.data = next;
  }
}
