"use client";

import { useState } from "react";
import { useLog } from "./log";
import {
  createPasskeyAndDeriveSalt,
  deriveSalt,
  describeMeraError,
  questionNamespace,
  type SaltResult,
} from "@/lib/mera";

export function MeraSection() {
  const { log, measure } = useLog();
  const [roomCode, setRoomCode] = useState("KOKO42");
  const [questionIndex, setQuestionIndex] = useState(1);
  const [result, setResult] = useState<SaltResult | null>(null);
  const [previous, setPrevious] = useState<SaltResult | null>(null);
  const [otherDeviceDigest, setOtherDeviceDigest] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespace = questionNamespace(roomCode, questionIndex);

  async function run(label: string, fn: () => Promise<SaltResult>) {
    setBusy(true);
    setError(null);
    try {
      const r = await measure(label, fn);
      setPrevious(result);
      setResult(r);
      log(`${label}: namespace=${r.namespace} digest=${r.saltDigest}`);
    } catch (err) {
      setError(describeMeraError(err));
    } finally {
      setBusy(false);
    }
  }

  const sameAsPrevious =
    previous && result && previous.namespace === result.namespace
      ? previous.saltDigest === result.saltDigest
      : null;
  const otherMatches =
    result && otherDeviceDigest.trim().length > 0
      ? otherDeviceDigest.trim().toLowerCase() === result.saltDigest.toLowerCase()
      : null;

  return (
    <section className="rounded-2xl border border-line bg-card p-5" data-testid="mera-section">
      <h2 className="text-lg font-black">2. Sealed-answer key from your passkey</h2>
      <p className="mt-1 text-sm text-ink-2">
        Each question gets its own key, computed on this device from your passkey. Nothing is
        saved anywhere. The same passkey on another device gives the same key.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-ink-2">
          Room code
          <input
            data-testid="room-code"
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 font-black uppercase tracking-[.2em] text-ink"
            value={roomCode}
            maxLength={6}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-xs font-bold text-ink-2">
          Question
          <input
            data-testid="question-index"
            type="number"
            min={1}
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 font-black text-ink"
            value={questionIndex}
            onChange={(e) => setQuestionIndex(Number(e.target.value) || 1)}
          />
        </label>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-ink-3" data-testid="namespace">
        {namespace}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          data-testid="mera-derive"
          disabled={busy}
          onClick={() => run("Mera: key from existing passkey", () => deriveSalt(namespace))}
          className="rounded-full bg-coral px-5 py-3 font-black text-white shadow-[0_10px_22px_rgba(255,107,74,.30)] disabled:opacity-45 disabled:shadow-none"
        >
          Get this question&apos;s key
        </button>
        <button
          data-testid="mera-create"
          disabled={busy}
          onClick={() =>
            run("Mera: new passkey + key", () => createPasskeyAndDeriveSalt(namespace, "Kokonad player"))
          }
          className="rounded-full border-2 border-coral px-5 py-3 font-black text-coral disabled:opacity-45"
        >
          I have no passkey here yet
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-peach p-3 text-sm font-bold text-danger" data-testid="mera-error">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-surface p-3 text-sm" data-testid="mera-result">
          <div className="text-xs font-bold text-ink-2">Key fingerprint (keccak256)</div>
          <div className="break-all font-mono text-xs" data-testid="mera-digest">
            {result.saltDigest}
          </div>
          <div className="mt-2 text-xs text-ink-3">
            passkey id: <span className="font-mono">{result.credentialId.slice(0, 16)}…</span>
          </div>
          {sameAsPrevious !== null && (
            <div className="mt-2 text-xs font-bold" data-testid="mera-repeat">
              Repeat on this device: {sameAsPrevious ? "same key" : "DIFFERENT key"}
            </div>
          )}
          <button
            className="mt-2 text-xs font-bold text-coral"
            onClick={() => setShowRaw((s) => !s)}
            data-testid="mera-toggle-raw"
          >
            {showRaw ? "Hide raw key" : "Show raw key (spike only)"}
          </button>
          {showRaw && (
            <div className="break-all font-mono text-[11px] text-ink-3" data-testid="mera-raw">
              {result.saltHex}
            </div>
          )}
        </div>
      )}

      <label className="mt-4 block text-xs font-bold text-ink-2">
        Paste the fingerprint shown on your other device
        <input
          data-testid="other-digest"
          className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs"
          placeholder="0x…"
          value={otherDeviceDigest}
          onChange={(e) => setOtherDeviceDigest(e.target.value)}
        />
      </label>
      {otherMatches !== null && (
        <p className="mt-2 text-sm font-black" data-testid="other-match">
          {otherMatches ? "Match: the other device has the same key." : "No match."}
        </p>
      )}
    </section>
  );
}
