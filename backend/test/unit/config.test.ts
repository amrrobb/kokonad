import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEPLOYMENTS_PATH, isPlaceholder, loadConfig, loadDeployments } from "../../src/config.js";

const KEY = `0x${"11".repeat(32)}`;
const FACTORY = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function writeDeployments(content: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "kokonad-cfg-")), "d.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}

describe("deployments", () => {
  it("reads the repo's real deployments/10143.json", () => {
    const d = loadDeployments(DEFAULT_DEPLOYMENTS_PATH);
    expect(d.chainId).toBe(10143);
  });

  it("treats any zero address as a placeholder and refuses to start on it", () => {
    const path = writeDeployments({ chainId: 10143, contracts: { RoomFactory: FACTORY, KokoToken: FACTORY, Forwarder: "0x0000000000000000000000000000000000000000" } });
    expect(isPlaceholder(loadDeployments(path))).toBe(true);
    expect(() => loadConfig({ RPC_URL: "http://x", RELAYER_PRIVATE_KEY: KEY, DEPLOYMENTS_PATH: path })).toThrow(/placeholder/);
  });

  it("requires a Forwarder address", () => {
    const path = writeDeployments({ chainId: 10143, contracts: { RoomFactory: FACTORY, KokoToken: FACTORY } });
    expect(() => loadDeployments(path)).toThrow(/Forwarder/);
  });

  it("refuses a mainnet deployments file", () => {
    const path = writeDeployments({ chainId: 143, contracts: { RoomFactory: FACTORY, KokoToken: FACTORY, Forwarder: FACTORY } });
    expect(() => loadDeployments(path)).toThrow(/testnet only/);
  });

  it("refuses a file without valid addresses", () => {
    const path = writeDeployments({ chainId: 10143, contracts: { RoomFactory: "0x0…", KokoToken: FACTORY } });
    expect(() => loadDeployments(path)).toThrow(/RoomFactory/);
  });
});

describe("loadConfig", () => {
  const deployed = () => writeDeployments({ chainId: 10143, contracts: { RoomFactory: FACTORY, KokoToken: FACTORY, Forwarder: FACTORY } });

  it("loads defaults from a deployed file", () => {
    const c = loadConfig({ RPC_URL: "http://x", RELAYER_PRIVATE_KEY: KEY, DEPLOYMENTS_PATH: deployed() });
    expect(c.dailyCapWei).toBe(5000000000000000000n);
    expect(c.maxRequestGas).toBe(8000000n);
    expect(c.deployments.contracts.RoomFactory).toBe(FACTORY);
  });

  it("requires the RPC URL and a well-formed operator key", () => {
    expect(() => loadConfig({ RELAYER_PRIVATE_KEY: KEY, DEPLOYMENTS_PATH: deployed() })).toThrow(/RPC_URL/);
    expect(() => loadConfig({ RPC_URL: "http://x", RELAYER_PRIVATE_KEY: "0x12", DEPLOYMENTS_PATH: deployed() })).toThrow(/32-byte/);
  });
});
