"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom } from "@/lib/host";
import { PlainError } from "@/lib/relay";
import { PrimaryButton } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-6 px-6 py-10">
      <div>
        <p className="text-[15px] font-black text-coral">Kokonad · host</p>
        <h1 className="mt-1 text-[30px] font-black leading-[1.1] tracking-[-.02em]">Start a room</h1>
        <p className="mt-2 font-extrabold text-ink-2">You fund the coins; people play for free and split the pots.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="People" value={people} onChange={setPeople} min={1} max={50} hint="expected in the room" />
        <Field label="Starting coins" value={deposit} onChange={setDeposit} min={1} max={1000} hint="each person gets" />
        <Field label="Play" value={play} onChange={setPlay} min={1} max={100} hint="coins per question" />
      </div>
      <p className="rounded-[14px] bg-peach px-4 py-3 text-[14px] font-extrabold">
        Budget: <span className="tabular-nums">{people * deposit}</span> coins, enough for {people} people at {deposit} each.
      </p>
      {error && <p className="text-center font-extrabold text-danger">{error}</p>}
      <PrimaryButton onClick={create} disabled={busy}>
        {busy ? "Creating your room…" : "Create room"}
      </PrimaryButton>
    </main>
  );
}
