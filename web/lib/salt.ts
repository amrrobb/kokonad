import { bytesToHex, type Hex } from "viem";

/**
 * The secret that keeps a sealed answer unreadable until reveal: commit = keccak256(abi.encode(answer, salt)).
 *
 * Random per (room, question), kept in memory, with the one browser-storage fallback CLAUDE.md allows
 * ("salt fallback") so a reload mid-question can still reveal. When Mera is wired this derives the salt
 * from the passkey instead (namespace kokonad/room/<code>/q/<index>) and nothing is stored at all.
 */
const memory = new Map<string, Hex>();
const keyOf = (room: string, id: bigint) => `kokonad:salt:${room.toLowerCase()}:${id}`;

export function saltFor(room: string, id: bigint): Hex {
  const k = keyOf(room, id);
  let salt = memory.get(k);
  if (!salt) {
    try {
      salt = (localStorage.getItem(k) as Hex | null) ?? undefined;
    } catch {
      /* storage unavailable: memory only */
    }
  }
  if (!salt) {
    salt = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    try {
      localStorage.setItem(k, salt);
    } catch {
      /* memory only */
    }
  }
  memory.set(k, salt);
  return salt;
}
