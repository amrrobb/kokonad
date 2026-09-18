"use client";

import { useEffect, useRef, useState } from "react";
import { encodeAbiParameters, keccak256, numberToHex, type Address } from "viem";
import { roomAbi, Status } from "@/lib/abi";
import { encodeFunctionData } from "viem";
import { PlainError, send } from "@/lib/relay";
import type { QuestionView, RoomView } from "@/lib/room";
import { saltFor } from "@/lib/salt";
import { PrimaryButton, coins } from "./ui";

const OPTION_COLORS = ["#7CC1F5", "#FF6B4A", "#F7C948", "#B9A2F0", "#A8E6CF", "#FFB08F"];
const optionWord = (i: bigint) => numberToHex(i, { size: 32 });

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Meta({ view, q }: { view: RoomView; q: QuestionView }) {
  return (
    <p className="text-[13px] font-bold text-ink-3">
      Question {Number(q.id) + 1} · everyone correct splits the pot
      <span className="float-right tabular-nums">
        pot <b className="text-ink">{coins(q.pot)}</b> · play {coins(view.playPrice)}
      </span>
    </p>
  );
}

function Timer({ left }: { left: number }) {
  return (
    <span className={`grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full border-[6px] text-[20px] font-black tabular-nums ${left <= 5 ? "border-coral-d text-coral-d" : "border-coral text-ink"}`}>
      {Math.max(0, left)}
    </span>
  );
}

function Note({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-card p-5">
      <h2 className="text-[18px] font-black">{title}</h2>
      {body && <p className="mt-1 font-extrabold text-ink-2">{body}</p>}
    </div>
  );
}

export function QuestionScreen({ room, view, q, onChange }: { room: Address; view: RoomView; q: QuestionView; onChange: () => void }) {
  const now = useNow();
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revealing = useRef(false);
  const left = q.lockAt - now;
  const open = q.status === Status.OPEN && left > 0;
  const closedForAnswers = q.status === Status.LOCKED || q.status === Status.REVEAL || (q.status === Status.OPEN && left <= 0);

  // Reveal is sent by the client on its own once answers lock (PRD §5). Guarded so a 2 s poll never sends twice.
  useEffect(() => {
    if (!closedForAnswers || !q.me.committed || q.me.revealed || revealing.current || left > 0) return;
    const salt = saltFor(room, q.id);
    const answer = localAnswer.get(`${room}:${q.id}`);
    if (answer === undefined) return; // committed from another tab: nothing to reveal here
    revealing.current = true;
    send(room, encodeFunctionData({ abi: roomAbi, functionName: "revealAnswer", args: [q.id, optionWord(BigInt(answer)), salt] }))
      .then(onChange)
      .catch(() => {
        revealing.current = false; // retry on the next poll
      });
  }, [closedForAnswers, q.me.committed, q.me.revealed, q.id, room, left, onChange]);

  async function lock() {
    if (pick === null) return;
    setBusy(true);
    setError(null);
    try {
      const salt = saltFor(room, q.id);
      const commit = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [optionWord(BigInt(pick)), salt]));
      localAnswer.set(`${room}:${q.id}`, pick);
      await send(room, encodeFunctionData({ abi: roomAbi, functionName: "commitAnswer", args: [q.id, commit] }));
      onChange();
    } catch (err) {
      setError(err instanceof PlainError ? err.message : "Something didn't go through. Your account is fine.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="flex items-start gap-4">
      <h1 className="flex-1 text-[24px] font-black leading-[1.15] tracking-[-.015em]">{q.text}</h1>
      {q.status === Status.OPEN && <Timer left={left} />}
    </div>
  );

  // Not in this question at all
  if (!q.me.charged && q.status <= Status.REVEAL) {
    const outOfPlays = view.me.deposit < view.playPrice;
    return (
      <div className="flex flex-col gap-5">
        <Meta view={view} q={q} />
        {header}
        <Note
          title={outOfPlays ? "You're out of plays." : "This question was already running."}
          body={outOfPlays ? "Ask the host for more coins to keep playing." : "You'll play from the next one."}
        />
      </div>
    );
  }

  // Answering
  if (open && q.me.hasPlay && !q.me.committed) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <Meta view={view} q={q} />
        {header}
        <ul className="flex flex-col gap-2.5">
          {q.options.map((o, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setPick(i)}
                className={`flex w-full items-center gap-3 rounded-[18px] border-2 bg-surface p-3 text-left text-[16px] font-black transition hover:-translate-y-px ${pick === i ? "border-coral bg-[#FFF0EA]" : "border-transparent"}`}
              >
                <span className="h-[38px] w-1.5 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                <span className="flex-1">{o}</span>
                {pick === i && <span className="grid h-6 w-6 place-items-center rounded-full bg-coral text-[12px] text-white">✓</span>}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="text-center text-[14px] font-extrabold text-danger">{error}</p>}
        <div className="mt-auto">
          <PrimaryButton onClick={lock} disabled={pick === null || busy}>
            {busy ? "Sealing…" : "Lock answer"}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // Sealed, waiting for time
  if (q.status === Status.OPEN && q.me.committed && left > 0) {
    return (
      <div className="flex flex-col gap-5">
        <Meta view={view} q={q} />
        {header}
        <Note title="Your answer is sealed" body={`Nobody can see it until time is up. ${q.answerers} of ${q.charged} have answered.`} />
      </div>
    );
  }

  // Answers closed, before the result
  if (closedForAnswers) {
    if (!q.me.committed) {
      return (
        <div className="flex flex-col gap-5">
          {header}
          <Note title={`Time's up. Your ${coins(view.playPrice)} coin${view.playPrice === 10n ** 18n ? "" : "s"} stayed in the pot.`} body="Next question is coming." />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Note
          title={q.me.revealed ? "Everyone's answers are open" : "Opening your answer…"}
          body={q.me.revealed ? `Waiting for the host to set the result. ${q.revealed} of ${q.answerers} answers open.` : "This happens on its own. Keep this tab open."}
        />
      </div>
    );
  }

  // Result
  if (q.status === Status.RESOLVED || q.status === Status.SETTLED) {
    const right = q.options[Number(q.outcome)] ?? "";
    const share = q.winners > 0 ? q.pot / BigInt(q.winners) : 0n;
    const disputeLeft = q.disputeUntil - now;
    if (q.me.correct) {
      return (
        <div className="flex flex-col gap-5">
          <div className="rounded-[22px] border border-line bg-card p-5">
            <p className="text-[13px] font-bold text-ink-3">Nice one!</p>
            <p className="text-[56px] font-black leading-none tracking-[-.04em] text-green tabular-nums">+{coins(share)}</p>
            <p className="mt-2 font-extrabold text-ink-2">
              {right} was right. Pot of {coins(q.pot)} split {q.winners} way{q.winners === 1 ? "" : "s"}
              {q.status === Status.SETTLED ? ", in your balance now." : ", arriving when the result is final."}
            </p>
          </div>
          {q.status === Status.RESOLVED && disputeLeft > 0 && <p className="text-center text-[13px] font-bold text-ink-3">Result can be disputed for {disputeLeft}s</p>}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-[22px] border border-line bg-card p-5">
          <p className="text-[13px] font-bold text-ink-3">Not this time</p>
          <p className="text-[56px] font-black leading-none tracking-[-.04em] text-ink-3 tabular-nums">−{coins(view.playPrice)}</p>
          <p className="mt-2 font-extrabold text-ink-2">
            {q.me.committed ? `You picked ${q.options[Number(q.me.answer)] ?? "another answer"}.` : "You sat this one out."} {right} was right. Your play went to the pot.
          </p>
        </div>
        {q.status === Status.RESOLVED && disputeLeft > 0 && <p className="text-center text-[13px] font-bold text-ink-3">Result can be disputed for {disputeLeft}s</p>}
      </div>
    );
  }

  if (q.status === Status.VOIDED) return <Note title="This question was cancelled." body="Everyone's play went back to their balance." />;
  return null;
}

/** Which option this tab sealed, per question. Memory only: the salt fallback is the one stored secret. */
const localAnswer = new Map<string, number>();
