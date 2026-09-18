"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { installWebAuthnProbe, onWebAuthn, type ProbeEvent } from "@/lib/webauthn-probe";

export type LogLine = { at: number; source: "page" | "passkey"; text: string };

type LogApi = {
  lines: LogLine[];
  passkeyEvents: ProbeEvent[];
  log: (text: string) => void;
  /** Runs an action and reports how many passkey prompts it caused and how long it took. */
  measure: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
};

const Ctx = createContext<LogApi | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [passkeyEvents, setPasskeyEvents] = useState<ProbeEvent[]>([]);

  useEffect(() => {
    installWebAuthnProbe();
    return onWebAuthn((e) => {
      setPasskeyEvents((prev) => [...prev, e]);
      setLines((prev) => [
        ...prev,
        {
          at: e.at,
          source: "passkey",
          text: `passkey ${e.op} rpId=${e.rpId} prf=${e.prf ? "yes" : "no"} -> ${e.outcome}${e.detail ? ` (${e.detail})` : ""}`,
        },
      ]);
    });
  }, []);

  const log = useCallback((text: string) => {
    setLines((prev) => [...prev, { at: Date.now(), source: "page", text }]);
  }, []);

  const measure = useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
      let prompts = 0;
      const stop = onWebAuthn(() => {
        prompts += 1;
      });
      const t0 = performance.now();
      try {
        const r = await fn();
        log(`${label}: ok in ${Math.round(performance.now() - t0)} ms, passkey prompts: ${prompts}`);
        return r;
      } catch (err) {
        log(
          `${label}: failed after ${Math.round(performance.now() - t0)} ms, passkey prompts: ${prompts}. ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      } finally {
        stop();
      }
    },
    [log],
  );

  const value = useMemo(() => ({ lines, passkeyEvents, log, measure }), [lines, passkeyEvents, log, measure]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLog(): LogApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLog outside LogProvider");
  return v;
}
