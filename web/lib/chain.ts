import { defineChain } from "viem";

export const MONAD_TESTNET_ID = 10143;

const rpcUrl =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";

/** viem chain for Monad testnet. Contract addresses come from deployments/10143.json, not here. */
export const monadTestnet = defineChain({
  id: MONAD_TESTNET_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

/** Same network in the shape Dynamic's `overrides.evmNetworks` expects. */
export const monadTestnetForDynamic = {
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
  chainId: MONAD_TESTNET_ID,
  chainName: "Monad Testnet",
  iconUrls: ["https://docs.monad.xyz/img/monad_logo.png"],
  name: "Monad Testnet",
  nativeCurrency: { decimals: 18, name: "MON", symbol: "MON" },
  networkId: MONAD_TESTNET_ID,
  rpcUrls: [rpcUrl],
  vanityName: "Monad Testnet",
};
