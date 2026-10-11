"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { Status } from "@/lib/abi";
import { draft, openQuestion, resolveQuestion, sealQuestions, settleQuestion } from "@/lib/host";
import { canDraft, draftQuestions, PlainError } from "@/lib/relay";
import { findRoom, readHostQuestions, readRoom, type HostQuestion } from "@/lib/room";
import { useSigner } from "@/lib/signer";
import { SignIn } from "@/components/sign-in";
import { Avatar, Moment, coins } from "@/components/ui";
import { Logo } from "@/components/brand";
import { Mascot, type Mood } from "@/components/mascot";
import { Appear, PopItem, RiseItem } from "@/components/motion";
import { AnswerDots, PotBowl } from "@/components/pot";

// three.js and gsap stay out of every other page's download; the flat bowl holds the space meanwhile.
const PotScene = dynamic(() => import("@/components/pot-scene"), { ssr: false, loading: () => <PotBowl coins={0} width={150} /> });

const OPTION_COLORS = ["#7CC1F5", "#FF6B4A", "#F7C948", "#B9A2F0", "#A8E6CF", "#FFB08F"];
/** Seconds this laptop waits past a chain deadline before acting: the newest block trails the wall clock. */
const CLOCK_MARGIN = 2;
const STATE: Record<number, string> = { 0: "sealed", 1: "live", 2: "opening answers", 3: "opening answers", 4: "result set", 5: "done", 6: "cancelled" };

/** Runs one host action behind the busy banner. Resolves true when it went through, false when it was refused. */
type Act = (label: string, fn: () => Promise<unknown>) => Promise<boolean>;
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
    <RiseItem className={`rounded-[22px] border bg-card p-5 ${live ? "live-glow border-coral" : "border-line"}`} data-testid={`question-${Number(q.id) + 1}`}>
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
                  className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[14px] border-2 bg-surface px-3 py-2.5 text-left text-[15px] font-black transition disabled:opacity-55 ${choosing === i ? "border-coral bg-[#FFF0EA]" : "border-line hover:border-coral"}`}
                >
                  {/* How the room answered, as a bar behind the option; the count beside it is the figure. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 opacity-25 transition-[width] duration-500 ease-out"
                    style={{ width: `${q.answerers > 0 ? ((q.tally[i] ?? 0) / q.answerers) * 100 : 0}%`, background: OPTION_COLORS[i % OPTION_COLORS.length] }}
                  />
                  <span className="relative">
                    <Swatch i={i} />
                  </span>
                  <span className="relative flex-1">{o}</span>
                  <span className="relative text-[13px] font-extrabold text-ink-3 tabular-nums">
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
    </RiseItem>
  );
}

const LANGUAGES = ["English", "Indonesian"];

/**
 * "What's tonight about?" in, a list of drafts out. The writer only proposes: every draft lands in the
 * same unsealed list as a typed question, where the host can remove it before sealing.
 */
function Drafter({ onDrafts, busy }: { onDrafts: (items: NewQuestion[]) => void; busy: boolean }) {
  const available = useQuery({ queryKey: ["can-draft"], queryFn: canDraft, staleTime: Infinity });
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  if (!available.data) return null;

  function draft() {
    if (thinking) return;
    // The button stays live so an empty brief gets an answer instead of a dead click: the example in
    // the box is only a placeholder, and more than one host has read it as text already typed.
    if (!topic.trim()) {
      setError("Say a few words about the event first, then ask again.");
      topicRef.current?.focus();
      return;
    }
    setThinking(true);
    setError(null);
    draftQuestions(topic.trim(), count, language)
      .then(onDrafts)
      .catch((err) => setError(err instanceof PlainError ? err.message : "Couldn't come up with questions just now. Try again, or write them yourself."))
      .finally(() => setThinking(false));
  }

  return (
    <div className="mt-3 rounded-[18px] border border-dashed border-gold bg-[#FFF9EA] p-4" data-testid="drafter">
      <p className="text-[14px] font-black">Short on time? Say what tonight is about and get a first draft.</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={topicRef}
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value.slice(0, 400));
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && draft()}
          placeholder="e.g. Jogja dev meetup: 3 lightning talks, pizza, a demo vote at the end"
          aria-label="What is the event about?"
          className="min-w-0 flex-1 rounded-[14px] border-2 border-line bg-surface px-3 py-2 text-[15px] font-extrabold outline-none focus:border-coral"
        />
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many questions" className="rounded-full border border-line bg-surface px-3 py-2 font-black">
          {[3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} questions
            </option>
          ))}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language" className="rounded-full border border-line bg-surface px-3 py-2 font-black">
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <Btn onClick={draft} disabled={thinking || busy}>
          {thinking ? "Writing…" : "Write them for me"}
        </Btn>
      </div>
      {thinking && (
        <div className="mt-3 flex flex-col gap-2" aria-hidden="true" data-testid="drafting">
          {Array.from({ length: Math.min(count, 4) }, (_, i) => (
            <div key={i} className="shimmer h-[46px] rounded-[14px]" style={{ opacity: 1 - i * 0.18 }} />
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] font-extrabold text-danger">{error}</p>}
      {!error && (
        <p className="mt-2 text-[12px] font-bold text-ink-3">
          {thinking ? "Thinking of things nobody in the room knows yet. This takes 10 to 25 seconds." : "You'll see every draft before anything is sealed. Remove the ones you don't like. You pick the right answer after time is up, so keep only what you can settle in the room."}
        </p>
      )}
    </div>
  );
}

/** Write the whole list first, seal it once. Nothing here is on the chain until "Seal". */
function Builder({ onSeal, busy, hasQuestions }: { onSeal: (items: NewQuestion[]) => Promise<boolean>; busy: boolean; hasQuestions: boolean }) {
  // Open while the room has no questions; once it has some, it folds away so the game keeps the screen,
  // and opens again only when the host asks for it.
  const [asked, setAsked] = useState<boolean | null>(null);
  const open = asked ?? !hasQuestions;
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

  if (!open) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-dashed border-line p-4">
        <p className="text-[14px] font-extrabold text-ink-2">Want more rounds? Questions can be added at any time.</p>
        <Btn tone="soft" onClick={() => setAsked(true)}>
          Write more questions
        </Btn>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] border border-line bg-card p-5">
      <h2 className="text-[16px] font-black">Write your questions</h2>
      <p className="mt-1 text-[13px] font-bold text-ink-3">Add as many as you like, then seal them all at once. Players see each one only when you open it.</p>
      <Drafter busy={busy} onDrafts={(items) => setList((prev) => [...prev, ...items])} />

      {list.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2" data-testid="unsealed-list">
          {list.map((q, i) => (
            <RiseItem key={i} i={i} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2 text-[14px] font-extrabold">
              <span className="text-ink-3 tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{q.text}</span>
                <span className="block truncate text-[12px] font-bold text-ink-3">{q.options.join(" · ")}</span>
              </span>
              <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className="shrink-0 text-[13px] font-black text-coral" aria-label={`Remove question ${i + 1}`}>
                Remove
              </button>
            </RiseItem>
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
              // Nothing typed or drafted is thrown away until the seal has gone through: a refused seal
              // leaves the list exactly as it was, ready to try again.
              void onSeal(toSeal).then((sealed) => {
                if (!sealed) return;
                setAsked(null);
                setList([]);
                setText("");
                setOpts(["", ""]);
              });
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

/** The way in, three ways: the code to read out, a picture to point a phone at, a link to paste in the group chat. */
function JoinLink({ code }: { code: string }) {
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [copied, setCopied] = useState(false);
  if (!origin) return null;
  const url = `${origin}/r/${code}`;
  return (
    <>
      <div className="mx-auto mt-3 w-fit rounded-[14px] border border-line bg-white p-2" data-testid="join-qr" data-url={url}>
        <QRCodeSVG value={url} size={128} fgColor="#3B1F14" bgColor="#FFFFFF" level="M" />
      </div>
      <p className="mt-2 break-all text-[12px] font-bold text-ink-3">
        {origin.replace(/^https?:\/\//, "")}/r/{code}
      </p>
      <button
        type="button"
        className="mt-1 text-[12px] font-black text-coral"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(url)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            })
            .catch(() => {});
        }}
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </>
  );
}

/**
 * The top of the host's screen: what is happening right now, in one line, and the pot. This is the part
 * of the laptop people look at when it is on a projector, so it always says the next thing to do.
 */
function Stage(props: { code: string; list: HostQuestion[]; people: number; seats: number | null; inFlight?: HostQuestion; nextId?: bigint; now: number }) {
  const { code, list, people, seats, inFlight, nextId, now } = props;
  let eyebrow: string;
  let title: string;
  let sub: string;
  // The coconut on the stage says how the room feels: asleep while nothing is happening, wide-eyed while a question runs, happy when someone is paid.
  let mood: Mood = "sleepy";
  if (inFlight && inFlight.status === Status.OPEN) {
    mood = "surprised";
    eyebrow = "Live";
    title = `Question ${Number(inFlight.id) + 1} is live.`;
    sub = `${Math.max(0, inFlight.lockAt - now)} s to answer.`;
  } else if (inFlight && inFlight.status !== Status.RESOLVED) {
    mood = "surprised";
    eyebrow = "Time's up";
    title = "Which answer was right?";
    sub = `Pick it on question ${Number(inFlight.id) + 1} below. The pot goes to whoever chose it.`;
  } else if (inFlight) {
    mood = "happy";
    eyebrow = "Result set";
    title = "Winners are being paid.";
    sub = "It happens on its own once nobody can disagree any more.";
  } else if (list.length === 0) {
    eyebrow = "Step 1";
    title = "Write tonight's questions.";
    sub = "Type them, or say what the event is about and take a first draft.";
  } else if (people === 0) {
    eyebrow = "Step 2";
    title = "Waiting for players.";
    sub = `Show them the code ${code}${seats ? `. ${seats} ${seats === 1 ? "seat" : "seats"} in this room.` : "."}`;
  } else if (nextId !== undefined) {
    mood = "happy";
    eyebrow = "Ready";
    title = `${people} in the room. Start when you like.`;
    sub = `Question ${Number(nextId) + 1} is next.`;
  } else {
    eyebrow = "All played";
    title = "That was every question.";
    sub = "Write more below to keep the room going.";
  }
  const potCoins = inFlight ? Number(inFlight.pot / 10n ** 18n) : 0;
  const live = !!inFlight && inFlight.status === Status.OPEN;
  const secondsLeft = inFlight ? Math.max(0, inFlight.lockAt - now) : 0;

  return (
    <section className="mb-5 flex items-center gap-4 overflow-hidden rounded-[22px] border border-line p-5 lg:gap-5 lg:p-6" style={{ background: "linear-gradient(120deg, #FFF9F3 0%, #FFEBDD 100%)" }} data-testid="stage">
      <Mascot mood={mood} size={104} disc className="hidden md:grid" />
      <div className="min-w-0 flex-1">
        <Appear key={title}>
          <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wide text-coral-d">
            {eyebrow === "Live" && <span className="live-glow inline-block h-2.5 w-2.5 rounded-full bg-coral" />}
            {eyebrow}
          </p>
          <h1 className="mt-1 text-[clamp(22px,2.4vw,34px)] font-black leading-[1.1] tracking-[-.02em]">{title}</h1>
        </Appear>
        <p className="mt-1.5 text-[15px] font-extrabold text-ink-2 tabular-nums">{sub}</p>
        {live && (
          <div className="mt-3">
            <AnswerDots answered={inFlight.answerers} of={inFlight.charged} />
          </div>
        )}
      </div>
      {live && (
        <div className="hidden shrink-0 flex-col items-center lg:flex" data-testid="stage-clock">
          <span className={`text-[72px] font-black leading-none tracking-[-.04em] tabular-nums ${secondsLeft <= 5 ? "text-coral-d" : "text-coral"}`}>{secondsLeft}</span>
          <span className="text-[12px] font-extrabold text-ink-3">seconds left</span>
        </div>
      )}
      <div className="hidden shrink-0 flex-col items-center sm:flex">
        <div className="h-[170px] w-[250px]">
          <PotScene coins={potCoins} />
        </div>
        <p className="text-[12px] font-extrabold text-ink-3 tabular-nums">{inFlight ? `In the pot: ${coins(inFlight.pot)}` : "The pot fills when a question opens."}</p>
      </div>
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

  const act: Act = (label, fn) => {
    setBusy(label);
    setError(null);
    return fn()
      .then(() => Promise.all([viewQ.refetch(), qsQ.refetch()]))
      .then(() => true)
      .catch((err) => {
        setError(err instanceof PlainError ? err.message : "Something didn't go through. Try again.");
        return false;
      })
      .finally(() => setBusy(null));
  };

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

  const alone = (moment: React.ReactNode) => (
    <main className="flex min-h-[100dvh] flex-col px-[clamp(20px,5vw,72px)] py-[clamp(18px,2vw,28px)]">
      <Logo />
      {moment}
    </main>
  );
  if (roomQ.isLoading || (room && !view)) return alone(<Moment mood="surprised" level={1} title={`Finding room ${code}…`} />);
  if (room === null || roomQ.isError) return alone(<Moment mood="oops" level={1} title={`Room ${code} not found.`} body="Check the code, or start a new room from the home page." />);
  if (!view || !room) return null;
  if (view.host.toLowerCase() !== me.toLowerCase()) {
    return alone(<Moment mood="oops" level={1} title="This room is hosted from another tab." body="Until sign-in is set up, a room can only be run from the tab that created it." />);
  }

  const list = questions ?? [];
  // The room runs one question at a time, and a question is finished only once it is paid out or cancelled.
  const inFlight = list.find((q) => q.status >= Status.OPEN && q.status <= Status.RESOLVED);
  const nextId = list.find((q) => q.status === Status.DRAFT)?.id;
  const blocked = inFlight ? `Question ${Number(inFlight.id) + 1} finishes first.` : view.people.length === 0 ? "Wait for someone to join." : null;
  const finished = (q: HostQuestion) => q.status === Status.SETTLED || q.status === Status.VOIDED;
  const toPlay = list.filter((q) => !finished(q));
  const played = list.filter(finished);
  const standings = view.people.map((p, i) => ({ ...p, i })).sort((a, b) => (a.coins === b.coins ? a.i - b.i : a.coins > b.coins ? -1 : 1));
  const leading = standings.length > 1 && standings[0]!.coins > standings[1]!.coins;
  // Sponsored rooms seat as many people as the budget can give a starting deposit to; both figures are from the chain.
  const seats = view.sponsored && view.startingDeposit > 0n ? view.people.length + Number((qsQ.data?.budget ?? 0n) / view.startingDeposit) : null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row lg:items-start">
      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-x-hidden border-b border-line bg-card p-5 lg:sticky lg:top-0 lg:h-[100dvh] lg:w-[260px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded-full bg-peach px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-coral-d">Host</span>
        </div>
        <div className="rounded-[22px] border border-line bg-surface p-4 text-center">
          <p className="text-[12px] font-bold text-ink-3">Room code</p>
          <p className="text-[34px] font-black tracking-[.16em]">{code}</p>
          <JoinLink code={code} />
        </div>
        <a href={`/host/${code}/screen`} target="_blank" rel="noreferrer" className="ledge -mt-2 rounded-full border border-line bg-surface px-4 py-2.5 text-center text-[13px] font-black">
          Open the big screen ↗
        </a>
        <div className="text-[14px] font-extrabold text-ink-2">
          <p>
            Budget left <b className="float-right text-ink tabular-nums">{coins(qsQ.data?.budget ?? 0n)}</b>
          </p>
          <p className="mt-1">
            In the room <b className="float-right text-ink tabular-nums">{seats ? `${view.people.length} of ${seats}` : view.people.length}</b>
          </p>
        </div>
        {/* Standings: most coins first, joining order between equals. Rows glide when the order changes. */}
        <ul className="flex flex-col gap-1.5" data-testid="standings">
          {standings.map((p, i) => (
            <PopItem key={p.address} layout className={`flex origin-left items-center gap-2 rounded-full py-0.5 pl-0.5 pr-3 text-[13px] font-extrabold ${i === 0 && leading ? "bg-[#FFF4D6]" : ""}`}>
              <Avatar address={p.address} name={p.name} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="tabular-nums text-ink-2">{coins(p.coins)}</span>
            </PopItem>
          ))}
        </ul>
        {view.people.length === 0 && <p className="text-[13px] font-bold text-ink-3">Nobody yet. They show up here the moment they join.</p>}
        {/* The coconut peeks over the note from the corner of the sidebar (DESIGN.md §6). */}
        <div className="relative mt-auto hidden pt-[74px] lg:block">
          <Mascot mood={inFlight ? (inFlight.status === Status.RESOLVED ? "happy" : "surprised") : view.people.length === 0 ? "sleepy" : "happy"} size={128} className="!absolute -right-3 top-0" />
          <p className="relative rounded-[14px] bg-peach p-3 text-[12px] font-bold text-ink-2">Keep this tab open: it opens questions and pays out winners for you.</p>
        </div>
        <p className="mt-auto rounded-[14px] bg-peach p-3 text-[12px] font-bold text-ink-2 lg:hidden">Keep this tab open: it opens questions and pays out winners for you.</p>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-8">
        <p className="mb-4 rounded-[14px] bg-bg-2 px-4 py-2 text-[13px] font-bold text-ink-3 lg:hidden">Best on a laptop.</p>
        {(busy || error) && <p className={`mb-4 rounded-[14px] px-4 py-3 font-extrabold ${error ? "bg-[#FDE7E2] text-danger" : "bg-peach"}`}>{error ?? `${busy}…`}</p>}
        <Stage code={code} list={list} people={view.people.length} seats={seats} inFlight={inFlight} nextId={nextId} now={now} />
        {/* What is live or still to play sits right under the stage, in playing order; finished questions move below. */}
        {[toPlay, played].map(
          (group, g) =>
            group.length > 0 && (
              <div key={g} className="mb-5">
                {g === 1 && <h2 className="mb-2 text-[12px] font-black uppercase tracking-wide text-ink-3">Played</h2>}
                <ol className="flex flex-col gap-4">
                  {group.map((q) => (
                    <QuestionCard key={String(q.id)} room={room} q={q} now={now} isNext={q.id === nextId} blocked={blocked} payFailed={payFailed.has(String(q.id))} busy={!!busy} act={act} />
                  ))}
                </ol>
              </div>
            ),
        )}
        {questions && (
          <Builder
            busy={!!busy}
            hasQuestions={list.length > 0}
            onSeal={(items) => act(items.length === 1 ? "Sealing the question" : `Sealing ${items.length} questions`, () => sealQuestions(room, items))}
          />
        )}
      </main>
    </div>
  );
}
