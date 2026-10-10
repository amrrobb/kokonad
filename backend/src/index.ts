import { formatEther } from "viem";
import { Ledger } from "./ledger.js";
import { loadConfig } from "./config.js";
import { ViemChain } from "./chain.js";
import { RelayService } from "./relay.js";
import { openAiCompleter, upstreamFromEnv } from "./questions.js";
import { createRelayServer } from "./server.js";

const config = loadConfig();
const chain = new ViemChain({
  rpcUrl: config.rpcUrl,
  chainId: config.deployments.chainId,
  operatorKey: config.operatorKey,
  contracts: config.deployments.contracts,
});

const actualChainId = await chain.getChainId();
if (actualChainId !== config.deployments.chainId) {
  throw new Error(`RPC is on chain ${actualChainId} but deployments file says ${config.deployments.chainId}`);
}

const ledger = new Ledger(config.ledgerPath);
const service = new RelayService(chain, ledger, config);
const upstream = upstreamFromEnv();
const server = createRelayServer(service, {
  allowedOrigin: process.env.ALLOWED_ORIGIN,
  complete: upstream && openAiCompleter(upstream),
  draftsPerHour: Number(process.env.DRAFTS_PER_HOUR ?? 20),
  draftsPerDay: Number(process.env.DRAFTS_PER_DAY ?? 60),
  draftBypassToken: process.env.DRAFT_BYPASS_TOKEN || undefined,
});
if (!upstream) console.warn("[questions] AI_API_KEY not set; hosts write every question by hand");
server.listen(config.port, async () => {
  const bal = await chain.getOperatorBalance();
  console.log(`[relay] relayer ${chain.operator} (${formatEther(bal)} MON) on chain ${actualChainId}, listening on :${config.port}`);
  // Monad: an account needs its 10 MON reserve before it can send ordinary transactions.
  if (bal < 10n ** 19n) console.warn("[relay] WARNING: relayer holds under 10 MON; Monad will refuse its transactions");
});
