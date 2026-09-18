"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { Status } from "@/lib/abi";
import { draft, openQuestion, resolveQuestion, sealQuestion, settleQuestion } from "@/lib/host";
import { PlainError } from "@/lib/relay";
import { findRoom, readHostQuestions, readRoom, type HostQuestion } from "@/lib/room";
import { getAccount } from "@/lib/signer";
import { Avatar, coins } from "@/components/ui";

const OPTION_COLORS = ["#7CC1F5", "#FF6B4A", "#F7C948", "#B9A2F0", "#A8E6CF", "#FFB08F"];
const STATE: Record<number, string> = { 0: "sealed", 1: "live", 2: "opening answers", 3: "opening answers", 4: "result set", 5: "done", 6: "cancelled" };

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 500);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Btn(props: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "primary" | "soft" }) {
  const primary = (props.tone ?? "primary") === "primary";
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-full px-5 py-2.5 text-[14px] font-black transition active:scale-[.98] disabled:opacity-45 ${primary ? "bg-coral text-white hover:bg-coral-d" : "border border-line bg-surface text-ink"}`}
    >
      {props.children}
    </button>
  );
}

function QuestionCard({ room, q, now, anyLive, act }: { room: Address; q: HostQuestion; now: number; anyLive: boolean; act: (label: string, fn: () => Promise<unknown>) => void }) {
  const d = draft(room, q.id);
  const [timer, setTimer] = useState(30);
  const text = q.text || d?.text || "Sealed question";
  const options = q.options.length ? q.options : (d?.options ?? []);
  const canResolve = q.status === Status.REVEAL || q.status === Status.LOCKED ? q.revealed >= q.answerers || now > q.revealUntil : false;
  return (
    <li className={`rounded-[22px] border bg-card p-5 ${q.status >= Status.OPEN && q.status <= Status.RESOLVED ? "border-coral" : "border-line"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">
            Question {Number(q.id) + 1} · {STATE[q.status]}
          </p>
          <h3 className="mt-1 text-[20px] font-black leading-tight">{text}</h3>
        </div>
        {q.status >= Status.OPEN && <p className="shrink-0 text-right text-[13px] font-bold text-ink-3">pot <b className="text-[18px] text-ink tabular-nums">{coins(q.pot)}</b></p>}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <li key={i} className={`flex items-center gap-2 rounded-full border bg-surface py-1.5 pl-2 pr-3 text-[13px] font-extrabold ${q.status >= Status.RESOLVED && q.status <= Status.SETTLED && Number(q.outcome) === i ? "border-gold bg-[#FFF4D6]" : "border-line"}`}>
            <span className="h-4 w-1.5 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
            {o}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px] font-extrabold text-ink-2">
        {q.status === Status.DRAFT && (d ? (
          <>
            <select value={timer} onChange={(e) => setTimer(Number(e.target.value))} className="rounded-full border border-line bg-surface px-3 py-2 font-black">
              {[20, 30, 45, 60, 90].map((t) => <option key={t} value={t}>{t} s</option>)}
            </select>
            <Btn onClick={() => act("Opening", () => openQuestion(room, d, timer))} disabled={anyLive}>Open question</Btn>
            {anyLive && <span className="text-ink-3">Finish the live question first.</span>}
          </>
        ) : <span className="text-ink-3">Sealed from another tab; open it there.</span>)}
        {q.status === Status.OPEN && <span className="tabular-nums">{Math.max(0, q.lockAt - now)} s left · {q.answerers} of {q.charged} answered</span>}
        {(q.status === Status.LOCKED || q.status === Status.REVEAL) && (
          <>
            <span className="tabular-nums">{q.revealed} of {q.answerers} answers open{!canResolve ? ` · waiting up to ${Math.max(0, q.revealUntil - now)} s` : ""}</span>
            <span className="basis-full text-ink-3">Set the result:</span>
            {options.map((o, i) => (
              <Btn key={i} tone="soft" disabled={!canResolve} onClick={() => act("Setting the result", () => resolveQuestion(room, q.id, i))}>{o}</Btn>
            ))}
          </>
        )}
        {q.status === Status.RESOLVED && (
          <>
            <span>{q.winners} right · {now < q.disputeUntil ? `can be disputed for ${q.disputeUntil - now} s` : "no longer disputable"}</span>
            <Btn onClick={() => act("Paying out", () => settleQuestion(room, q.id))} disabled={now <= q.disputeUntil}>Pay out</Btn>
          </>
        )}
        {q.status === Status.SETTLED && <span>Paid out to {q.winners} {q.winners === 1 ? "person" : "people"}.</span>}
        {q.status === Status.VOIDED && <span>Cancelled. Everyone&apos;s play went back.</span>}
      </div>
    </li>
  );
}

export default function HostRoom() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const me = getAccount().address;
  const now = useNow();
  const [text, setText] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomQ = useQuery({ queryKey: ["room-address", code], queryFn: () => findRoom(code), staleTime: Infinity });
  const room = roomQ.data;
  const viewQ = useQuery({ queryKey: ["room", room, me], queryFn: () => readRoom(room as Address, me), enabled: !!room, refetchInterval: 2000 });
  const qsQ = useQuery({ queryKey: ["host-questions", room], queryFn: () => readHostQuestions(room as Address), enabled: !!room, refetchInterval: 2000 });
  const view = viewQ.data;

  function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    fn()
      .then(() => Promise.all([viewQ.refetch(), qsQ.refetch()]))
      .catch((err) => setError(err instanceof PlainError ? err.message : "Something didn't go through. Try again."))
      .finally(() => setBusy(null));
  }

  if (roomQ.isLoading || (room && !view)) return <p className="p-10 text-center font-extrabold text-ink-3">Finding room {code}…</p>;
  if (room === null || roomQ.isError) return <p className="p-10 text-center font-extrabold text-ink-2">Room {code} not found.</p>;
  if (!view || !room) return null;
  if (view.host.toLowerCase() !== me.toLowerCase()) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-[24px] font-black">This room is hosted from another tab.</h1>
        <p className="mt-2 font-extrabold text-ink-2">Until sign-in is set up, a room can only be run from the tab that created it.</p>
      </main>
    );
  }

  const questions = qsQ.data?.questions ?? [];
  const anyLive = questions.some((q) => q.status >= Status.OPEN && q.status <= Status.REVEAL);
  const validNew = text.trim() && opts.filter((o) => o.trim()).length >= 2;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-line bg-card p-5 lg:w-[260px] lg:border-b-0 lg:border-r">
        <p className="text-[15px] font-black text-coral">Kokonad · host</p>
        <div className="rounded-[22px] border border-line bg-surface p-4 text-center">
          <p className="text-[12px] font-bold text-ink-3">Room code</p>
          <p className="text-[34px] font-black tracking-[.16em]">{code}</p>
          <p className="text-[12px] font-bold text-ink-3">Join at /r/{code}</p>
        </div>
        <div className="text-[14px] font-extrabold text-ink-2">
          <p>Budget left <b className="float-right text-ink tabular-nums">{coins(qsQ.data?.budget ?? 0n)}</b></p>
          <p className="mt-1">In the room <b className="float-right text-ink tabular-nums">{view.people.length}</b></p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {view.people.map((p) => (
            <li key={p.address} className="flex items-center gap-2 text-[13px] font-extrabold">
              <Avatar address={p.address} name={p.name} />
              {p.name}
            </li>
          ))}
        </ul>
        <p className="mt-auto rounded-[14px] bg-peach p-3 text-[12px] font-bold text-ink-2">Keep this tab open: until sign-in is set up, the room is tied to it.</p>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-8">
        <p className="mb-4 rounded-[14px] bg-bg-2 px-4 py-2 text-[13px] font-bold text-ink-3 lg:hidden">Best on a laptop.</p>
        {(busy || error) && (
          <p className={`mb-4 rounded-[14px] px-4 py-3 font-extrabold ${error ? "bg-[#FDE7E2] text-danger" : "bg-peach"}`}>{error ?? `${busy}…`}</p>
        )}
        <section className="rounded-[22px] border border-line bg-card p-5">
          <h2 className="text-[16px] font-black">Add a question</h2>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 140))}
            placeholder="Who wins tonight's final?"
            className="mt-3 w-full rounded-[18px] border-2 border-line bg-surface px-4 py-3 text-[18px] font-black outline-none focus:border-coral"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {opts.map((o, i) => (
              <input
                key={i}
                value={o}
                onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value.slice(0, 40) : x)))}
                placeholder={`Option ${i + 1}`}
                className="rounded-[14px] border-2 border-line bg-surface px-3 py-2 font-extrabold outline-none focus:border-coral"
              />
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            {opts.length < 6 && <button type="button" onClick={() => setOpts([...opts, ""])} className="font-black text-coral">+ option</button>}
            <div className="ml-auto">
              <Btn
                disabled={!validNew || !!busy}
                onClick={() =>
                  act("Sealing the question", async () => {
                    await sealQuestion(room, text.trim(), opts.map((o) => o.trim()).filter(Boolean));
                    setText("");
                    setOpts(["", ""]);
                  })
                }
              >
                Seal question
              </Btn>
            </div>
          </div>
          <p className="mt-2 text-[12px] font-bold text-ink-3">Sealed questions can&apos;t be changed later. Players see them only when you open them.</p>
        </section>
        <ul className="mt-6 flex flex-col gap-4">
          {[...questions].reverse().map((q) => (
            <QuestionCard key={String(q.id)} room={room} q={q} now={now} anyLive={anyLive} act={act} />
          ))}
        </ul>
      </main>
    </div>
  );
}
