import { getAddress, type Address, type Hex } from "viem";
import type { Chain } from "../../src/chain.js";

/** In-memory chain: rooms by code, balances, and a log of every send. */
export class FakeChain implements Chain {
  readonly operator = getAddress("0x00000000000000000000000000000000000000aa");
  readonly rooms = new Map<string, { address: Address; participants: Address[] }>();
  readonly balances = new Map<string, bigint>();
  readonly sends: Array<{ to: Address; wei: bigint }> = [];
  failNextSend = false;
  failResolve = false;
  sendDelayMs = 0;

  addRoom(code: string, address: string, participants: string[] = []): Address {
    const a = getAddress(address);
    this.rooms.set(code, { address: a, participants: participants.map((p) => getAddress(p)) });
    return a;
  }

  async getBalance(address: Address): Promise<bigint> {
    return this.balances.get(address.toLowerCase()) ?? 0n;
  }

  async resolveRoom(code: string): Promise<Address | null> {
    if (this.failResolve) throw new Error("rpc down");
    return this.rooms.get(code)?.address ?? null;
  }

  async getParticipants(room: Address): Promise<Address[]> {
    for (const r of this.rooms.values()) if (r.address === room) return r.participants;
    return [];
  }

  async sendValue(to: Address, wei: bigint): Promise<Hex> {
    if (this.sendDelayMs) await new Promise((r) => setTimeout(r, this.sendDelayMs));
    if (this.failNextSend) {
      this.failNextSend = false;
      throw new Error("send failed");
    }
    this.sends.push({ to, wei });
    const key = to.toLowerCase();
    this.balances.set(key, (this.balances.get(key) ?? 0n) + wei);
    return `0x${this.sends.length.toString(16).padStart(64, "0")}` as Hex;
  }
}
