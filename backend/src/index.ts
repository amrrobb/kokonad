import { Ledger } from "./ledger.js";
import { loadConfig } from "./config.js";
import { ViemChain } from "./chain.js";
import { DripService } from "./drip.js";
import { createDripServer } from "./server.js";

const config = loadConfig();
const chain = new ViemChain({
  rpcUrl: config.rpcUrl,
  chainId: config.deployments.chainId,
  operatorKey: config.operatorKey,
  factory: config.deployments.contracts.RoomFactory,
});

const actualChainId = await chain.getChainId();
if (actualChainId !== config.deployments.chainId) {
  throw new Error(`RPC is on chain ${actualChainId} but deployments file says ${config.deployments.chainId}`);
}

const ledger = new Ledger(config.ledgerPath);
const service = new DripService(chain, ledger, config);
const server = createDripServer(service, { allowedOrigin: process.env.ALLOWED_ORIGIN });
server.listen(config.port, () => {
  console.log(`[drip] operator ${chain.operator} on chain ${actualChainId}, listening on :${config.port}`);
});
