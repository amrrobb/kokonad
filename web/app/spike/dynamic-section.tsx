"use client";

import { useEffect, useRef, useState } from "react";
import {
  DynamicWidget,
  useDynamicContext,
  useDynamicWaas,
  useIsLoggedIn,
  useWalletDelegation,
} from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { ChainEnum } from "@dynamic-labs/sdk-api-core";
import { useLog } from "./log";
import { MONAD_TESTNET_ID, monadTestnet } from "@/lib/chain";

export function DynamicSection() {
  const { log, measure } = useLog();
  const { primaryWallet, sdkHasLoaded } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const waas = useDynamicWaas();
  const delegation = useWalletDelegation();

  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const creating = useRef(false);

  const address = primaryWallet?.address ?? null;
  const isEmbedded = Boolean(primaryWallet?.connector?.isEmbeddedWallet);
  const delegated = delegation.getWalletsDelegatedStatus();
  const myDelegation = delegated.find(
    (w) => address && w.address.toLowerCase() === address.toLowerCase(),
  );

  useEffect(() => {
    if (!sdkHasLoaded) return;
    log(`Dynamic loaded. signed in: ${isLoggedIn}. account: ${address ?? "none"}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkHasLoaded, isLoggedIn, address]);

  // Make sure a signed-in user has an embedded account, in case auto-creation is off in the dashboard.
  useEffect(() => {
    if (!sdkHasLoaded || !isLoggedIn || !waas.dynamicWaasIsEnabled) return;
    if (waas.getWaasWallets().length > 0 || creating.current) return;
    creating.current = true;
    measure("Dynamic: create embedded account", () => waas.createWalletAccount([ChainEnum.Evm]))
      .catch(() => undefined)
      .finally(() => {
        creating.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkHasLoaded, isLoggedIn, waas.dynamicWaasIsEnabled, address]);

  useEffect(() => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) return;
    let cancelled = false;
    primaryWallet
      .getWalletClient(String(MONAD_TESTNET_ID))
      .then((c) => {
        if (!cancelled) setChainId(c.chain.id);
      })
      .catch((err) => log(`wallet client on ${MONAD_TESTNET_ID}: ${String(err)}`));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWallet?.address]);

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setLastError(null);
    try {
      await measure(label, fn);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const signSample = () =>
    act("Dynamic: confirm a sample answer (message)", async () => {
      if (!primaryWallet || !isEthereumWallet(primaryWallet)) throw new Error("No account yet");
      const client = await primaryWallet.getWalletClient(String(MONAD_TESTNET_ID));
      const sig = await client.signMessage({
        message: `kokonad spike ${new Date().toISOString()}`,
      });
      setSignature(sig);
    });

  const sendNoop = () =>
    act("Dynamic: send an empty action on Monad testnet", async () => {
      if (!primaryWallet || !isEthereumWallet(primaryWallet)) throw new Error("No account yet");
      const client = await primaryWallet.getWalletClient(String(MONAD_TESTNET_ID));
      const hash = await client.sendTransaction({
        to: client.account.address,
        value: 0n,
        chain: monadTestnet,
      });
      setTxHash(hash);
    });

  const enableDelegation = () =>
    act("Dynamic: allow the app to act for me", async () => {
      await delegation.initDelegationProcess();
      log(
        `delegation statuses: ${JSON.stringify(
          delegation.getWalletsDelegatedStatus().map((w) => ({ a: w.address, s: w.status })),
        )}`,
      );
    });

  return (
    <section className="rounded-2xl border border-line bg-card p-5" data-testid="dynamic-section">
      <h2 className="text-lg font-black">1. Sign in and your account</h2>
      <p className="mt-1 text-sm text-ink-2">
        Sign in with Google, email or a passkey. An account on Monad testnet is created for you.
      </p>

      <div className="mt-4">
        <DynamicWidget />
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-bold text-ink-2">Loaded</dt>
        <dd data-testid="dyn-loaded">{sdkHasLoaded ? "yes" : "no"}</dd>
        <dt className="font-bold text-ink-2">Signed in</dt>
        <dd data-testid="dyn-signed-in">{isLoggedIn ? "yes" : "no"}</dd>
        <dt className="font-bold text-ink-2">Account</dt>
        <dd className="break-all font-mono text-xs" data-testid="dyn-address">
          {address ?? "—"}
        </dd>
        <dt className="font-bold text-ink-2">Account kind</dt>
        <dd data-testid="dyn-kind">
          {primaryWallet ? `${primaryWallet.connector.name}${isEmbedded ? " (embedded)" : ""}` : "—"}
        </dd>
        <dt className="font-bold text-ink-2">Network</dt>
        <dd data-testid="dyn-chain">
          {chainId === null ? "—" : chainId === MONAD_TESTNET_ID ? "Monad testnet (10143)" : `chain ${chainId}`}
        </dd>
        <dt className="font-bold text-ink-2">App may act for me</dt>
        <dd data-testid="dyn-delegation">
          {delegation.delegatedAccessEnabled === false
            ? "feature off in dashboard"
            : (myDelegation?.status ?? "not yet")}
        </dd>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <button
          data-testid="dyn-delegate"
          disabled={!isLoggedIn || busy !== null || myDelegation?.status === "delegated"}
          onClick={enableDelegation}
          className="rounded-full border-2 border-coral px-5 py-3 font-black text-coral disabled:opacity-45"
        >
          Let the app act for me during the game
        </button>
        <button
          data-testid="dyn-sign"
          disabled={!isLoggedIn || busy !== null}
          onClick={signSample}
          className="rounded-full bg-coral px-5 py-3 font-black text-white shadow-[0_10px_22px_rgba(255,107,74,.30)] disabled:opacity-45 disabled:shadow-none"
        >
          Confirm a sample answer
        </button>
        <button
          data-testid="dyn-send"
          disabled={!isLoggedIn || busy !== null}
          onClick={sendNoop}
          className="rounded-full border-2 border-coral px-5 py-3 font-black text-coral disabled:opacity-45"
        >
          Send an empty action to Monad testnet
        </button>
      </div>

      {signature && (
        <p className="mt-3 break-all font-mono text-[11px] text-ink-3" data-testid="dyn-signature">
          confirmed: {signature.slice(0, 42)}…
        </p>
      )}
      {txHash && (
        <p className="mt-2 break-all font-mono text-[11px] text-ink-3" data-testid="dyn-txhash">
          sent: {txHash}
        </p>
      )}
      {lastError && (
        <p className="mt-3 rounded-xl bg-peach p-3 text-sm font-bold text-danger" data-testid="dyn-error">
          {lastError}
        </p>
      )}
    </section>
  );
}
