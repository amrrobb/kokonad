/** Pure decisions, kept free of I/O so they can be tested exhaustively. */

export type DripDecision =
  | { ok: true; amountWei: bigint }
  | { ok: false; reason: "already_dripped" | "daily_cap" | "in_flight" };

export function decideDrip(input: {
  alreadyDripped: boolean;
  inFlight: boolean;
  dripWei: bigint;
  sentLast24hWei: bigint;
  dailyCapWei: bigint;
}): DripDecision {
  if (input.alreadyDripped) return { ok: false, reason: "already_dripped" };
  if (input.inFlight) return { ok: false, reason: "in_flight" };
  if (input.sentLast24hWei + input.dripWei > input.dailyCapWei) return { ok: false, reason: "daily_cap" };
  return { ok: true, amountWei: input.dripWei };
}

/**
 * How much to send so a participant can keep answering. Zero when they are at or above the threshold.
 * Tops up to `target`, not by a fixed amount, so repeated rounds never overshoot.
 */
export function topUpAmount(balanceWei: bigint, thresholdWei: bigint, targetWei: bigint): bigint {
  if (balanceWei >= thresholdWei) return 0n;
  return targetWei > balanceWei ? targetWei - balanceWei : 0n;
}

/**
 * Plans a top-up round under the remaining daily budget. Participants are served in list order
 * (join order); anyone that no longer fits is reported as skipped rather than silently dropped.
 */
export function planTopUps(
  balances: ReadonlyArray<{ address: string; balanceWei: bigint }>,
  opts: { thresholdWei: bigint; targetWei: bigint; budgetWei: bigint },
): { sends: Array<{ address: string; amountWei: bigint }>; skipped: string[] } {
  const sends: Array<{ address: string; amountWei: bigint }> = [];
  const skipped: string[] = [];
  let remaining = opts.budgetWei;
  for (const { address, balanceWei } of balances) {
    const amountWei = topUpAmount(balanceWei, opts.thresholdWei, opts.targetWei);
    if (amountWei === 0n) continue;
    if (amountWei > remaining) {
      skipped.push(address);
      continue;
    }
    remaining -= amountWei;
    sends.push({ address, amountWei });
  }
  return { sends, skipped };
}
