import type { LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * The player's account: the one seam between the UI and whoever holds the key.
 *
 * Today it is a key held in memory for this tab only (never written to browser storage, CLAUDE.md #5),
 * so reloading the tab starts a new account. When Dynamic is configured this returns Dynamic's embedded
 * account instead; callers only ever see a LocalAccount that can sign, and no caller changes.
 * The account never sends a transaction and never needs MON: it only signs requests for the relayer.
 */
let account: LocalAccount | null = null;

export function getAccount(): LocalAccount {
  if (!account) account = privateKeyToAccount(generatePrivateKey());
  return account;
}
