import { getAddress, type Address, type Hex } from "viem";
import type { Chain, ForwardRequest, Simulation } from "../../src/chain.js";

/** In-memory chain: which targets are ours, which signatures verify, and a log of relayed requests. */
export class FakeChain implements Chain {
  readonly operator = getAddress("0x00000000000000000000000000000000000000aa");
  readonly token = getAddress("0x00000000000000000000000000000000000000f7");
  readonly factory = getAddress("0x00000000000000000000000000000000000000fa");
  readonly rooms = new Set<string>();
  readonly executed: ForwardRequest[] = [];
  verifies = true;
  simulation: Simulation = { ok: true };
  failRead = false;
  failExecute = false;
  costWei = 10n ** 16n;

  async isFactoryRoom(address: Address): Promise<boolean> {
    if (this.failRead) throw new Error("rpc down");
    return this.rooms.has(address.toLowerCase());
  }

  async verify(): Promise<boolean> {
    if (this.failRead) throw new Error("rpc down");
    return this.verifies;
  }

  async simulate(): Promise<Simulation> {
    return this.simulation;
  }

  async execute(req: ForwardRequest): Promise<{ txHash: Hex; costWei: bigint }> {
    if (this.failExecute) throw new Error("send failed");
    this.executed.push(req);
    return { txHash: `0x${this.executed.length.toString(16).padStart(64, "0")}` as Hex, costWei: this.costWei };
  }
}
