"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { Status } from "@/lib/abi";
import { draft, openQuestion, resolveQuestion, sealQuestions, settleQuestion } from "@/lib/host";
import { PlainError } from "@/lib/relay";
import { findRoom, readHostQuestions, readRoom, type HostQuestion } from "@/lib/room";
import { useSigner } from "@/lib/signer";
import { SignIn } from "@/components/sign-in";
import { Avatar, coins } from "@/components/ui";

const OPTION_COLORS = ["#7CC1F5", "#FF6B4A", "#F7C948", "#B9A2F0", "#A8E6CF", "#FFB08F"];
/** Seconds this laptop waits past a chain deadline before acting: the newest block trails the wall clock. */
const CLOCK_MARGIN = 2;
const STATE: Record<number, string> = { 0: "sealed", 1: "live", 2: "opening answers", 3: "opening answers", 4: "result set", 5: "done", 6: "cancelled" };

type Act = (label: string, fn: () => Promise<unknown>) => void;
interface NewQuestion {
  text: string;
  options: string[];
}

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

function Swatch({ i }: { i: number }) {
  return <span className="h-4 w-1.5 shrink-0 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />;
}

function QuestionCard(props: { room: Address; q: HostQuestion; now: number; isNext: boolean; blocked: string | null; payFailed: boolean; busy: boolean; act: Act }) {
  const { room, q, now, isNext, blocked, payFailed, busy, act } = props;
  const d = draft(room, q.id);
  const [timer, setTimer] = useState(30);
  const [choosing, setChoosing] = useState<number | null>(null);
  const text = q.text || d?.text || "Sealed question";
  const options = q.options.length ? q.options : (d?.options ?? []);
  const settingResult = q.status === Status.LOCKED || q.status === Status.REVEAL;
  const canResolve = settingResult && (q.revealed >= q.answerers || now > q.revealUntil);
  const decided = q.status === Status.RESOLVED || q.status === Status.SETTLED;
  const live = q.status >= Status.OPEN && q.status <= Status.RESOLVED;

  return (
    <li className={`rounded-[22px] border bg-card p-5 ${live ? "border-coral" : "border-line"}`} data-testid={`question-${Number(q.id) + 1}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">
            Question {Number(q.id) + 1} · {STATE[q.status]}
          </p>
          <h3 className="mt-1 text-[20px] font-black leading-tight">{text}</h3>
        </div>
        {q.status >= Status.OPEN && (
          <p className="shrink-0 text-right text-[13px] font-bold text-ink-3">
            pot <b className="text-[18px] text-ink tabular-nums">{coins(q.pot)}</b>
          </p>
        )}
      </div>

      {/* One list of options. While the host is setting the result, the options ARE the control. */}
      {settingResult ? (
        <div className="mt-3">
          <p className="text-[13px] font-extrabold text-ink-2 tabular-nums">
            {q.revealed} of {q.answerers} answers open
            {!canResolve ? ` · waiting up to ${Math.max(0, q.revealUntil - now)} s` : " · which one was right?"}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {options.map((o, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={!canResolve || busy}
                  onClick={() => setChoosing(i)}
                  className={`flex w-full items-center gap-3 rounded-[14px] border-2 bg-surface px-3 py-2.5 text-left text-[15px] font-black transition disabled:opacity-55 ${choosing === i ? "border-coral bg-[#FFF0EA]" : "border-line hover:border-coral"}`}
                >
                  <Swatch i={i} />
                  <span className="flex-1">{o}</span>
                  <span className="text-[13px] font-extrabold text-ink-3 tabular-nums">
                    {q.tally[i] ?? 0} {(q.tally[i] ?? 0) === 1 ? "answer" : "answers"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {choosing !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[14px] bg-peach px-4 py-3 text-[14px] font-extrabold" role="alertdialog" aria-label="Confirm the result">
              <span className="flex-1">
                Set “{options[choosing]}” as the result? This can&apos;t be changed, and the pot goes to whoever picked it.
              </span>
              <Btn tone="soft" onClick={() => setChoosing(null)}>Back</Btn>
              <Btn
                disabled={busy}
                onClick={() => {
                  const pick = choosing;
                  setChoosing(null);
                  act("Setting the result", () => resolveQuestion(room, q.id, pick));
                }}
              >
                Set result
              </Btn>
            </div>
          )}
        </div>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {options.map((o, i) => (
            <li key={i} className={`flex items-center gap-2 rounded-full border bg-surface py-1.5 pl-2 pr-3 text-[13px] font-extrabold ${decided && Number(q.outcome) === i ? "border-gold bg-[#FFF4D6]" : "border-line"}`}>
              <Swatch i={i} />
              {o}
              {decided && <span className="text-ink-3 tabular-nums">· {q.tally[i] ?? 0}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px] font-extrabold text-ink-2">
        {q.status === Status.DRAFT &&
          (!d ? (
            <span className="text-ink-3">Sealed from another tab; open it there.</span>
          ) : isNext ? (
            <>
              <select value={timer} onChange={(e) => setTimer(Number(e.target.value))} aria-label="Time to answer" className="rounded-full border border-line bg-surface px-3 py-2 font-black">
                {[20, 30, 45, 60, 90].map((t) => (
                  <option key={t} value={t}>
                    {t} s
                  </option>
                ))}
              </select>
              <Btn onClick={() => act("Opening", () => openQuestion(room, d, timer))} disabled={!!blocked || busy}>
                Open question {Number(q.id) + 1}
              </Btn>
              {blocked && <span className="text-ink-3">{blocked}</span>}
            </>
          ) : (
            <span className="text-ink-3">Up next after question {Number(q.id)}.</span>
          ))}
        {q.status === Status.OPEN && (
          <span className="tabular-nums">
            {Math.max(0, q.lockAt - now)} s left · {q.answerers} of {q.charged} answered
          </span>
        )}
        {q.status === Status.RESOLVED && (
          <>
            <span>
              {q.winners} right ·{" "}
              {now <= q.disputeUntil + CLOCK_MARGIN ? `pays out on its own in ${q.disputeUntil + CLOCK_MARGIN - now + 1} s unless people disagree` : "paying out…"}
            </span>
            {payFailed && (
              <Btn onClick={() => act("Paying out", () => settleQuestion(room, q.id))} disabled={busy}>
                Pay out
              </Btn>
            )}
          </>
        )}
        {q.status === Status.SETTLED && (
          <span>
            Paid out to {q.winners} {q.winners === 1 ? "person" : "people"}.
          </span>
        )}
        {q.status === Status.VOIDED && <span>Cancelled. Everyone&apos;s play went back.</span>}
      </div>
    </li>
  );
}

/** Write the whole list first, seal it once. Nothing here is on the chain until "Seal". */
function Builder({ onSeal, busy }: { onSeal: (items: NewQuestion[]) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [list, setList] = useState<NewQuestion[]>([]);
  const clean = opts.map((o) => o.trim()).filter(Boolean);
  const valid = text.trim().length > 0 && clean.length >= 2;
  // Typing a question and pressing Seal without "Add" still includes it: nobody should lose what they typed.
  const toSeal = valid ? [...list, { text: text.trim(), options: clean }] : list;

  function add() {
    if (!valid) return;
    setList([...list, { text: text.trim(), options: clean }]);
    setText("");
    setOpts(["", ""]);
  }

  return (
    <section className="rounded-[22px] border border-line bg-card p-5">
      <h2 className="text-[16px] font-black">Write your questions</h2>
      <p className="mt-1 text-[13px] font-bold text-ink-3">Add as many as you like, then seal them all at once. Players see each one only when you open it.</p>

      {list.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2" data-testid="unsealed-list">
          {list.map((q, i) => (
            <li key={i} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2 text-[14px] font-extrabold">
              <span className="text-ink-3 tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{q.text}</span>
                <span className="block truncate text-[12px] font-bold text-ink-3">{q.options.join(" · ")}</span>
              </span>
              <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className="shrink-0 text-[13px] font-black text-coral" aria-label={`Remove question ${i + 1}`}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 140))}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Who wins tonight's final?"
        className="mt-3 w-full rounded-[18px] border-2 border-line bg-surface px-4 py-3 text-[18px] font-black outline-none focus:border-coral"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {opts.map((o, i) => (
          <input
            key={i}
            value={o}
            onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value.slice(0, 40) : x)))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`Option ${i + 1}`}
            className="rounded-[14px] border-2 border-line bg-surface px-3 py-2 font-extrabold outline-none focus:border-coral"
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {opts.length < 6 && (
          <button type="button" onClick={() => setOpts([...opts, ""])} className="font-black text-coral">
            + option
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <Btn tone="soft" disabled={!valid} onClick={add}>
            Add another
          </Btn>
          <Btn
            disabled={toSeal.length === 0 || busy}
            onClick={() => {
              onSeal(toSeal);
              setList([]);
              setText("");
              setOpts(["", ""]);
            }}
          >
            {toSeal.length <= 1 ? "Seal question" : `Seal ${toSeal.length} questions`}
          </Btn>
        </div>
      </div>
      <p className="mt-2 text-[12px] font-bold text-ink-3">Sealed questions can&apos;t be changed later.</p>
    </section>
  );
}

export default function HostRoom() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const signer = useSigner();
  if (!signer) return <SignIn code={code} title="Your room is waiting." body="Continue with the account that created it." />;
  return <HostRoomFor key={signer.address} code={code} me={signer.address} />;
}

function HostRoomFor({ code, me }: { code: string; me: Address }) {
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payFailed, setPayFailed] = useState<Set<string>>(new Set());
  const paying = useRef<Set<string>>(new Set());

  const roomQ = useQuery({ queryKey: ["room-address", code], queryFn: () => findRoom(code), staleTime: Infinity });
  const room = roomQ.data;
  const viewQ = useQuery({ queryKey: ["room", room, me], queryFn: () => readRoom(room as Address, me), enabled: !!room, refetchInterval: 2000 });
  const qsQ = useQuery({ queryKey: ["host-questions", room], queryFn: () => readHostQuestions(room as Address), enabled: !!room, refetchInterval: 2000 });
  const view = viewQ.data;
  const questions = qsQ.data?.questions;

  function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    fn()
      .then(() => Promise.all([viewQ.refetch(), qsQ.refetch()]))
      .catch((err) => setError(err instanceof PlainError ? err.message : "Something didn't go through. Try again."))
      .finally(() => setBusy(null));
  }

  // Pay-outs need no click: once a result can no longer be disputed, this tab sends the pay-out itself.
  // Guarded per question so a 2 s poll never sends twice; a failure brings back a manual button.
  useEffect(() => {
    if (!room || !questions) return;
    for (const q of questions) {
      const key = String(q.id);
      if (q.status !== Status.RESOLVED || now <= q.disputeUntil + CLOCK_MARGIN || paying.current.has(key)) continue;
      paying.current.add(key);
      settleQuestion(room, q.id)
        .then(() => Promise.all([viewQ.refetch(), qsQ.refetch()]))
        .catch(() => setPayFailed((prev) => new Set(prev).add(key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, questions, now]);

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

  const list = questions ?? [];
  // The room runs one question at a time, and a question is finished only once it is paid out or cancelled.
  const inFlight = list.find((q) => q.status >= Status.OPEN && q.status <= Status.RESOLVED);
  const nextId = list.find((q) => q.status === Status.DRAFT)?.id;
  const blocked = inFlight ? `Question ${Number(inFlight.id) + 1} finishes first.` : view.people.length === 0 ? "Wait for someone to join." : null;

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
          <p>
            Budget left <b className="float-right text-ink tabular-nums">{coins(qsQ.data?.budget ?? 0n)}</b>
          </p>
          <p className="mt-1">
            In the room <b className="float-right text-ink tabular-nums">{view.people.length}</b>
          </p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {view.people.map((p) => (
            <li key={p.address} className="flex items-center gap-2 text-[13px] font-extrabold">
              <Avatar address={p.address} name={p.name} />
              {p.name}
            </li>
          ))}
        </ul>
        <p className="mt-auto rounded-[14px] bg-peach p-3 text-[12px] font-bold text-ink-2">Keep this tab open: it opens questions and pays out winners for you.</p>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-8">
        <p className="mb-4 rounded-[14px] bg-bg-2 px-4 py-2 text-[13px] font-bold text-ink-3 lg:hidden">Best on a laptop.</p>
        {(busy || error) && <p className={`mb-4 rounded-[14px] px-4 py-3 font-extrabold ${error ? "bg-[#FDE7E2] text-danger" : "bg-peach"}`}>{error ?? `${busy}…`}</p>}
        <Builder busy={!!busy} onSeal={(items) => act(items.length === 1 ? "Sealing the question" : `Sealing ${items.length} questions`, () => sealQuestions(room, items))} />
        {/* In playing order: the next thing to do is always the first unfinished card. */}
        <ol className="mt-6 flex flex-col gap-4">
          {list.map((q) => (
            <QuestionCard key={String(q.id)} room={room} q={q} now={now} isNext={q.id === nextId} blocked={blocked} payFailed={payFailed.has(String(q.id))} busy={!!busy} act={act} />
          ))}
        </ol>
      </main>
    </div>
  );
}
