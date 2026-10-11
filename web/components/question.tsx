"use client";

import { useEffect, useRef, useState } from "react";
import { encodeAbiParameters, keccak256, numberToHex, type Address } from "viem";
import { roomAbi, Status } from "@/lib/abi";
import { encodeFunctionData } from "viem";
import { PlainError, send } from "@/lib/relay";
import type { QuestionView, RoomView } from "@/lib/room";
import { saltFor } from "@/lib/salt";
import Image from "next/image";
import { motion } from "motion/react";
import { flyCoins } from "./coins";
import { Appear, POP, RiseItem } from "./motion";
import { AnswerDots, PotBowl } from "./pot";
import { Avatar, PrimaryButton, coins } from "./ui";

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

const RING = 2 * Math.PI * 26;

/** Seconds left as a number inside a ring that empties. The ring moves at one steady pace; the last five seconds turn darker and tick. */
function Timer({ left, total }: { left: number; total: number }) {
  const shown = Math.max(0, left);
  const part = total > 0 ? Math.min(1, shown / total) : 0;
  const late = left <= 5;
  return (
    <span className="relative grid h-[64px] w-[64px] shrink-0 place-items-center" data-testid="timer">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-peach)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={late ? "var(--color-coral-d)" : "var(--color-coral)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - part)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke .2s" }}
        />
      </svg>
      <motion.span key={late ? shown : "calm"} initial={late ? { scale: 1.3 } : false} animate={{ scale: 1 }} transition={POP} className={`text-[20px] font-black tabular-nums ${late ? "text-coral-d" : "text-ink"}`}>
        {shown}
      </motion.span>
    </span>
  );
}

/** The room at a glance while a question is open: the pot as a bowl, and one dot per player that fills when they seal. */
function Pulse({ q }: { q: QuestionView }) {
  return (
    <div className="flex items-center gap-4 rounded-[18px] bg-bg-2 px-4 py-2.5" data-testid="pulse">
      <PotBowl coins={Number(q.pot / 10n ** 18n)} width={64} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-wide text-ink-3">Sealed so far</span>
        <AnswerDots answered={q.answerers} of={q.charged} />
      </div>
    </div>
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
      {q.status === Status.OPEN && <Timer left={left} total={q.lockAt - q.openAt} />}
    </div>
  );

  // Not in this question at all
  if (!q.me.charged && q.status <= Status.REVEAL) {
    const outOfPlays = view.me.deposit < view.playPrice;
    return (
      <Appear key="watching" className="flex flex-col gap-5">
        <Meta view={view} q={q} />
        {header}
        <Note
          title={outOfPlays ? "You're out of plays." : "This question was already running."}
          body={outOfPlays ? "Ask the host for more coins to keep playing." : "You'll play from the next one."}
        />
      </Appear>
    );
  }

  // Answering
  if (open && q.me.hasPlay && !q.me.committed) {
    return (
      <Appear key="answering" className="flex flex-1 flex-col gap-4">
        <Meta view={view} q={q} />
        {header}
        <Pulse q={q} />
        <ul className="flex flex-col gap-2.5">
          {q.options.map((o, i) => (
            <RiseItem key={i} i={i + 1}>
              <button
                type="button"
                onClick={() => setPick(i)}
                className={`flex w-full items-center gap-3 rounded-[18px] border-2 bg-surface p-3 text-left text-[16px] font-black transition hover:-translate-y-px active:scale-[.98] ${pick === i ? "border-coral bg-[#FFF0EA]" : "border-transparent"}`}
              >
                <span className="h-[38px] w-1.5 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                <span className="flex-1">{o}</span>
                {pick === i && (
                  <motion.span initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={POP} className="grid h-6 w-6 place-items-center rounded-full bg-coral text-[12px] text-white">
                    ✓
                  </motion.span>
                )}
              </button>
            </RiseItem>
          ))}
        </ul>
        {error && <p className="text-center text-[14px] font-extrabold text-danger">{error}</p>}
        <div className="mt-auto">
          <PrimaryButton onClick={lock} disabled={pick === null || busy}>
            {busy ? "Sealing…" : "Lock answer"}
          </PrimaryButton>
        </div>
      </Appear>
    );
  }

  // Sealed, waiting for time
  if (q.status === Status.OPEN && q.me.committed && left > 0) {
    return (
      <Appear key="sealed" className="flex flex-col gap-4">
        <Meta view={view} q={q} />
        {header}
        <Pulse q={q} />
        <Note title="Your answer is sealed" body={`Nobody can see it until time is up. ${q.answerers} of ${q.charged} have answered.`} />
      </Appear>
    );
  }

  // Answers closed, before the result
  if (closedForAnswers) {
    if (!q.me.committed) {
      return (
        <Appear key="missed" className="flex flex-col gap-5">
          {header}
          <Note title={`Time's up. Your ${coins(view.playPrice)} coin${view.playPrice === 10n ** 18n ? "" : "s"} stayed in the pot.`} body="Next question is coming." />
        </Appear>
      );
    }
    return (
      <Appear key="opening" className="flex flex-col gap-5">
        {header}
        <Note
          title={q.me.revealed ? "Everyone's answers are open" : "Opening your answer…"}
          body={q.me.revealed ? `Waiting for the host to set the result. ${q.revealed} of ${q.answerers} answers open.` : "This happens on its own. Keep this tab open."}
        />
      </Appear>
    );
  }

  // Result
  if (q.status === Status.RESOLVED || q.status === Status.SETTLED) return <Result view={view} q={q} now={now} />;

  if (q.status === Status.VOIDED) return <Note title="This question was cancelled." body="Everyone's play went back to their balance." />;
  return null;
}

function Result({ view, q, now }: { view: RoomView; q: QuestionView; now: number }) {
  const right = q.options[Number(q.outcome)] ?? "";
  const share = q.winners > 0 ? q.pot / BigInt(q.winners) : 0n;
  const disputeLeft = q.disputeUntil - now;
  const settled = q.status === Status.SETTLED;
  const won = q.me.correct;
  const nameOf = (address: string) => view.people.find((p) => p.address.toLowerCase() === address.toLowerCase())?.name || "Someone";

  // Coins fly once, at the moment this screen sees the pay-out land (result set → paid). A screen
  // opened after the pay-out shows the final state without replaying it.
  const amount = useRef<HTMLParagraphElement>(null);
  const seenUnpaid = useRef(!settled);
  useEffect(() => {
    if (won && settled && seenUnpaid.current && amount.current) {
      seenUnpaid.current = false;
      flyCoins(amount.current);
    }
  }, [won, settled]);

  return (
    <Appear key="result" className="flex flex-1 flex-col gap-3">
      <div className={`relative overflow-hidden rounded-[22px] border bg-card p-5 pr-[108px] ${won ? "border-[#F5DFA0] shadow-[0_12px_30px_rgba(242,183,43,.22)]" : "border-line"}`}>
        <p className="text-[13px] font-bold text-ink-2">{won ? "Nice one!" : "Not this time"}</p>
        <p ref={amount} data-testid="result-amount" className={`text-[56px] font-black leading-none tracking-[-.04em] tabular-nums ${won ? "text-green" : "text-ink-3"}`}>
          {won ? `+${coins(share)}` : `−${coins(view.playPrice)}`}
        </p>
        <p className="mt-2 font-extrabold text-ink-2">
          {won ? (
            <>
              {right} was right. Pot of {coins(q.pot)} split {q.winners} way{q.winners === 1 ? "" : "s"}
              {settled ? ", in your balance now." : ", arriving when the result is final."}
            </>
          ) : (
            <>
              {q.me.committed ? `You picked ${q.options[Number(q.me.answer)] ?? "another answer"}.` : "You sat this one out."} {right} was right. Your play went to the pot.
            </>
          )}
        </p>
        <Image src={won ? "/mascot/mascot-happy.png" : "/mascot/mascot-oops.png"} alt="" width={96} height={96} className={`absolute right-3 top-3 h-[88px] w-[88px] object-contain ${won ? "drift" : ""}`} />
      </div>

      {q.picks.length > 0 && (
        <ul className="flex flex-col gap-1.5" data-testid="result-rows">
          {q.picks.map((p, i) => (
            <RiseItem
              key={p.address}
              i={i + 2}
              opacity={p.won ? 1 : 0.55}
              className={`flex items-center gap-2 rounded-[14px] border px-3 py-2 text-[14px] font-extrabold ${p.won ? "border-[#F5DFA0] bg-[#FFF4D6]" : "border-line bg-surface"} ${p.me ? "outline outline-2 outline-coral" : ""}`}
            >
              <Avatar address={p.address} name={nameOf(p.address)} />
              <span className="min-w-0 flex-1 truncate">
                {nameOf(p.address)}
                {p.me ? " (you)" : ""}
              </span>
              <span className={`shrink-0 font-bold ${p.won ? "text-ink-2" : "text-ink-3"}`}>{q.options[p.option] ?? ""}</span>
              <span className="min-w-[40px] shrink-0 text-right font-black text-green tabular-nums">{p.won ? `+${coins(share)}` : ""}</span>
            </RiseItem>
          ))}
        </ul>
      )}

      {q.status === Status.RESOLVED && disputeLeft > 0 && (
        <p className="mt-auto pt-3 text-[13px] font-bold text-ink-2">
          Result can be disputed for <b className="tabular-nums">{disputeLeft}s</b>
        </p>
      )}
    </Appear>
  );
}

/** Which option this tab sealed, per question. Memory only: the salt fallback is the one stored secret. */
const localAnswer = new Map<string, number>();
