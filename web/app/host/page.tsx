"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRoom } from "@/lib/host";
import { PlainError, rememberDraftKey } from "@/lib/relay";
import { useSigner } from "@/lib/signer";
import { SignIn } from "@/components/sign-in";
import { Logo } from "@/components/brand";
import { Mascot } from "@/components/mascot";
import { Appear } from "@/components/motion";
import { Coin, PrimaryButton } from "@/components/ui";

function Field(props: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; hint: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-bold text-ink-3">{props.label}</span>
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(Math.max(props.min, Math.min(props.max, Number(e.target.value) || props.min)))}
        className="rounded-[18px] border-2 border-line bg-surface px-4 py-3 text-[18px] font-black tabular-nums outline-none focus:border-coral"
      />
      <span className="text-[12px] font-bold text-ink-3">{props.hint}</span>
    </label>
  );
}

export default function NewRoom() {
  const signer = useSigner();
  // /host?draftkey=... : the builder's own browser remembers the key that lifts drafting limits.
  useEffect(() => rememberDraftKey(window.location.search), []);
  if (!signer) return <SignIn title="Start a room" body="Continue so the room stays yours, on any device." />;
  return <NewRoomForm />;
}

function NewRoomForm() {
  const router = useRouter();
  const [people, setPeople] = useState(10);
  const [deposit, setDeposit] = useState(20);
  const [play, setPlay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { code } = await createRoom({ people, deposit, play });
      router.push(`/host/${code}`);
    } catch (err) {
      setError(err instanceof PlainError ? err.message : "Something didn't go through. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="px-[clamp(20px,5vw,72px)] py-[clamp(18px,2vw,28px)]">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col items-center justify-center gap-8 px-6 pb-12 lg:flex-row lg:gap-14">
        <Appear className="flex w-full max-w-[520px] flex-col gap-6">
          <div>
            <p className="self-start text-[13px] font-black uppercase tracking-wide text-coral-d">Host</p>
            <h1 className="mt-1 text-[clamp(30px,4vw,44px)] font-black leading-[1.05] tracking-[-.025em]">Start a room</h1>
            <p className="mt-2 text-[16px] font-extrabold text-ink-2">You fund the coins; people play for free and split the pots.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="People" value={people} onChange={setPeople} min={1} max={50} hint="expected in the room" />
            <Field label="Starting coins" value={deposit} onChange={setDeposit} min={1} max={1000} hint="each person gets" />
            <Field label="Play" value={play} onChange={setPlay} min={1} max={100} hint="coins per question" />
          </div>
          <p className="flex items-center gap-2.5 rounded-[18px] bg-peach px-4 py-3.5 text-[15px] font-black">
            <Coin size={22} />
            <span>
              Budget: <span className="tabular-nums">{people * deposit}</span> coins, enough for {people} people at {deposit} each.
            </span>
          </p>
          {error && <p className="text-center font-extrabold text-danger">{error}</p>}
          <PrimaryButton onClick={create} disabled={busy}>
            {busy ? "Creating your room…" : "Create room"}
          </PrimaryButton>
        </Appear>
        <Mascot mood={busy ? "happy" : "surprised"} size={300} disc priority className="hidden lg:grid" />
      </main>
    </div>
  );
}
