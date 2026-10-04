"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DynamicSection } from "./dynamic-section";
import { MeraSection } from "./mera-section";
import { LogProvider, useLog } from "./log";

const hasDynamic = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID);

function Coexistence() {
  const { passkeyEvents, lines } = useLog();
  // Empty on the server, the real host in the browser, without a hydration mismatch.
  const host = useSyncExternalStore(() => () => {}, () => window.location.host, () => "");
  const rpIds = useMemo(
    () => Array.from(new Set(passkeyEvents.map((e) => e.rpId ?? "?"))),
    [passkeyEvents],
  );
  return (
    <section className="rounded-2xl border border-line bg-card p-5" data-testid="coexistence">
      <h2 className="text-lg font-black">3. What happened on this page</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-bold text-ink-2">Passkey prompts</dt>
        <dd data-testid="prompt-count">{passkeyEvents.length}</dd>
        <dt className="font-bold text-ink-2">Passkey domains seen</dt>
        <dd className="font-mono text-xs" data-testid="rpids">
          {rpIds.length ? rpIds.join(", ") : "—"}
        </dd>
        <dt className="font-bold text-ink-2">Page host</dt>
        <dd className="font-mono text-xs" data-testid="host">
          {host}
        </dd>
      </dl>
      <ol className="mt-3 max-h-72 space-y-1 overflow-auto rounded-xl bg-surface p-3 font-mono text-[11px]" data-testid="log">
        {lines.map((l, i) => (
          <li key={i} className={l.source === "passkey" ? "text-coral-d" : "text-ink-2"}>
            {new Date(l.at).toLocaleTimeString()} {l.text}
          </li>
        ))}
        {lines.length === 0 && <li className="text-ink-3">nothing yet</li>}
      </ol>
    </section>
  );
}

export default function SpikePage() {
  return (
    <LogProvider>
      <main className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-12">
        <header>
          <h1 className="text-2xl font-black">Sign-in spike</h1>
          <p className="text-sm text-ink-2">
            Week-1 check: sign-in account and per-question sealed keys on one page.
          </p>
        </header>
        {hasDynamic ? (
          <DynamicSection />
        ) : (
          <section className="rounded-2xl border border-line bg-card p-5" data-testid="dynamic-missing">
            <h2 className="text-lg font-black">1. Sign in and your account</h2>
            <p className="mt-1 text-sm text-danger">
              Not configured. Set NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID in web/.env.local and restart.
            </p>
          </section>
        )}
        <MeraSection />
        <Coexistence />
      </main>
    </LogProvider>
  );
}
