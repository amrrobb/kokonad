"use client";

import { DynamicContextProvider, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors, isEthereumWallet } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { useEffect, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { MONAD_TESTNET_ID, monadTestnet, monadTestnetForDynamic } from "@/lib/chain";
import { setSignedInSigner } from "@/lib/signer";
import { MotionRoot } from "@/components/motion";

const wagmiConfig = createConfig({
  chains: [monadTestnet],
  multiInjectedProviderDiscovery: false,
  transports: { [monadTestnet.id]: http() },
  ssr: true,
});

export function MissingEnvironmentNotice() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-black">Sign-in is not configured</h1>
      <p className="mt-2 text-sm text-ink-2">
        Set <code>NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID</code> in <code>web/.env.local</code>{" "}
        (see <code>web/.env.example</code>) and restart the dev server.
      </p>
    </main>
  );
}

/**
 * Hands the signed-in person's embedded account to lib/signer, and takes it away on sign-out.
 * NOT YET RUN AGAINST A LIVE ENVIRONMENT (no environment ID as of 4 Oct): see docs/spikes/dynamic-mera.md.
 */
function SignerBridge() {
  const { primaryWallet } = useDynamicContext();
  useEffect(() => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setSignedInSigner(null);
      return;
    }
    const wallet = primaryWallet;
    setSignedInSigner({
      address: wallet.address as Address,
      signTypedData: async (data) => {
        const client = await wallet.getWalletClient(String(MONAD_TESTNET_ID));
        return client.signTypedData({ ...data, account: client.account } as Parameters<typeof client.signTypedData>[0]);
      },
    });
  }, [primaryWallet]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

  if (!environmentId) {
    // Sign-in cannot start without an environment ID. Everything that does not need it still
    // renders (the Mera salt part of /spike), so the page stays useful.
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <MotionRoot>{children}</MotionRoot>
        </WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors],
        // Monad testnet only. The dashboard's default networks (Ethereum mainnet) must not reach the
        // embedded account: the product is testnet-only and wagmi knows no other chain.
        overrides: { evmNetworks: [monadTestnetForDynamic] },
        initialAuthenticationMode: "connect-and-sign",
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <SignerBridge />
            <MotionRoot>{children}</MotionRoot>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
