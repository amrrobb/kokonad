"use client";

import { DynamicContextProvider, mergeNetworks } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { useState, type ReactNode } from "react";
import { monadTestnet, monadTestnetForDynamic } from "@/lib/chain";

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

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

  if (!environmentId) {
    // Sign-in cannot start without an environment ID. Everything that does not need it still
    // renders (the Mera salt part of /spike), so the page stays useful.
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors],
        overrides: {
          evmNetworks: (networks) => mergeNetworks([monadTestnetForDynamic], networks),
        },
        initialAuthenticationMode: "connect-and-sign",
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
