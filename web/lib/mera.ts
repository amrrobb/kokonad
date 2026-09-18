import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  isMeraError,
  type PasskeyCredentialMetadata,
} from "@category-labs/mera";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { bytesToHex, keccak256 } from "viem";

/**
 * One PRF namespace per question. The 32-byte WebAuthn PRF salt is sha256 of this string,
 * so a different question yields an unrelated PRF output (Mera: "salts genuinely namespaced").
 */
export function questionNamespace(roomCode: string, questionIndex: number): string {
  return `kokonad/room/${roomCode.trim().toUpperCase()}/q/${questionIndex}`;
}

export function namespaceToPrfSalt(namespace: string): Uint8Array {
  return sha256(utf8ToBytes(namespace));
}

export function rpIdForThisPage(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PASSKEY_RP_ID;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return window.location.hostname;
}

export type SaltResult = {
  namespace: string;
  credentialId: string;
  /** keccak256 of the 32-byte PRF output. Shown to the user; the raw bytes stay in memory only. */
  saltDigest: `0x${string}`;
  /** Raw PRF output, hex. Only rendered behind a "reveal" toggle on the spike page. */
  saltHex: `0x${string}`;
};

/** Ask an existing passkey for the salt of one question. One passkey prompt. */
export async function deriveSalt(
  namespace: string,
  credential?: PasskeyCredentialMetadata,
): Promise<SaltResult> {
  const { credentialId, prfOutput } = await getPasskeyPrfOutput({
    rpId: rpIdForThisPage(),
    prfSalt: namespaceToPrfSalt(namespace),
    ...(credential ? { credential } : {}),
  });
  return {
    namespace,
    credentialId,
    saltDigest: keccak256(prfOutput),
    saltHex: bytesToHex(prfOutput),
  };
}

/** Create a new passkey for this site and return the salt of one question in the same ceremony. */
export async function createPasskeyAndDeriveSalt(
  namespace: string,
  displayName: string,
): Promise<SaltResult> {
  const rpId = rpIdForThisPage();
  const r = await createPasskeyWithPrfOutput({
    rp: { id: rpId, name: "Kokonad" },
    user: { name: displayName, displayName },
    prfSalt: namespaceToPrfSalt(namespace),
  });
  return {
    namespace,
    credentialId: r.credentialId,
    saltDigest: keccak256(r.prfOutput),
    saltHex: bytesToHex(r.prfOutput),
  };
}

export function describeMeraError(err: unknown): string {
  if (isMeraError(err)) {
    switch (err.code) {
      case "PRF_UNAVAILABLE":
        return "This device's passkey cannot derive a secret (no PRF support). Try another device or browser.";
      case "PASSKEY_OPERATION_FAILED":
        return `Passkey step was cancelled or failed: ${String(err.cause ?? err.message)}`;
      default:
        return `${err.code}: ${err.message}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
