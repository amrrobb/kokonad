import { useSyncExternalStore } from "react";
import type { Address, Hex, TypedDataDefinition } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * The player's account: the one seam between the UI and whoever holds the key.
 * It never sends a transaction and never needs MON: it only signs requests for the relayer.
 *
 * Two sources, chosen by configuration, never mixed:
 *  - Sign-in configured (NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID): the account is the signed-in person's
 *    embedded account, pushed in by SignerBridge (app/providers.tsx). Until someone is signed in
 *    there is no signer, and screens show the sign-in step. The account survives reloads and devices.
 *  - Not configured: a key held in memory for this tab only (never written to browser storage,
 *    CLAUDE.md #5). Reloading starts a new account. This is what the end-to-end suite runs on.
 */
export interface Signer {
  address: Address;
  signTypedData: (data: TypedDataDefinition) => Promise<Hex>;
}

export const signInEnabled = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID);

let tab: Signer | null = null;
function tabSigner(): Signer {
  if (!tab) {
    const account = privateKeyToAccount(generatePrivateKey());
    tab = { address: account.address, signTypedData: (data) => account.signTypedData(data) };
  }
  return tab;
}

let signedIn: Signer | null = null;
const listeners = new Set<() => void>();

/** Called by the sign-in provider when a person signs in, switches account, or signs out (null). */
export function setSignedInSigner(next: Signer | null): void {
  if (next?.address === signedIn?.address) return;
  signedIn = next;
  for (const l of listeners) l();
}

/**
 * "Just play on this device": the tab account even though sign-in is configured. For people who will
 * not type a code at an event. The account lasts as long as the tab; the screens say so.
 */
let guest = false;
export function continueAsGuest(): void {
  guest = true;
  for (const l of listeners) l();
}

/** The current signer, or null when sign-in is configured and nobody has signed in or chosen to play as a guest. */
export function getSigner(): Signer | null {
  if (!signInEnabled) return tabSigner();
  return signedIn ?? (guest ? tabSigner() : null);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** React view of getSigner(). Null on the server and before sign-in, so the first client render matches. */
export function useSigner(): Signer | null {
  return useSyncExternalStore(subscribe, getSigner, () => null);
}
