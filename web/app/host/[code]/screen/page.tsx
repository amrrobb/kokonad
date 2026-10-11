"use client";

/**
 * The big screen: what the room looks at on the projector. The host's view without any controls
 * (PRD §9), so it needs no account and can be opened on any machine with the room's code. It reads
 * the chain like every other screen and shows a question only once the host has opened it.
 */
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { zeroAddress, type Address } from "viem";
import { Status } from "@/lib/abi";
import { findRoom, readHostQuestions, readRoom, type HostQuestion, type RoomView } from "@/lib/room";
import { Logo } from "@/components/brand";
import { Mascot } from "@/components/mascot";
import { Appear, EASE_OUT, POP, PopItem } from "@/components/motion";
import { AnswerDots, PotBowl } from "@/components/pot";
import { Avatar, Coin, coins } from "@/components/ui";

const PotScene = dynamic(() => import("@/components/pot-scene"), { ssr: false, loading: () => <PotBowl coins={0} width={150} /> });

const OPTION_COLORS = ["#7CC1F5", "#FF6B4A", "#F7C948", "#B9A2F0", "#A8E6CF", "#FFB08F"];

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(t);
  }, []);
  return now;
}

const eyebrow = "text-[clamp(13px,1.5vw,22px)] font-black uppercase tracking-wide text-coral-d";
const giant = "font-black leading-[.95] tracking-[-.04em]";

/** Nobody is playing yet: the code is the hero, and people pop in as they join. */
function Waiting({ code, view }: { code: string; view: RoomView }) {
  const [origin] = useState(() => window.location.origin);
  const url = `${origin}/r/${code}`;
  const n = view.people.length;
  return (
    <Appear key="waiting" className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-4">
        <Mascot mood={n === 0 ? "sleepy" : "happy"} size={260} disc priority className="!h-[clamp(140px,22vw,340px)] !w-[clamp(140px,22vw,340px)]" />
      </div>
      <div className="flex min-w-0 flex-col gap-[1.6vw]">
        <p className={eyebrow}>Join the game</p>
        <div className="flex flex-wrap items-center gap-[2.4vw]">
          <div className="rounded-[clamp(14px,1.6vw,26px)] border border-line bg-surface p-[clamp(8px,1vw,16px)]" data-testid="screen-qr" data-url={url}>
            <QRCodeSVG value={url} size={220} fgColor="#3B1F14" bgColor="#FFFFFF" level="M" className="h-[clamp(120px,15vw,240px)] w-[clamp(120px,15vw,240px)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[clamp(14px,1.6vw,24px)] font-extrabold text-ink-2">
              Scan, or open <b className="text-ink">{origin.replace(/^https?:\/\//, "")}/join</b> and type
            </p>
            <p className={`${giant} mt-[.6vw] pl-[.04em] text-[clamp(56px,10vw,150px)] tracking-[.12em]`} data-testid="screen-code">
              {code}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[clamp(18px,2.2vw,34px)] font-black tabular-nums" data-testid="screen-count">
            {n} in the room
          </p>
          <ul className="flex flex-wrap gap-2">
            {view.people.slice(0, 24).map((p) => (
              <PopItem key={p.address} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[clamp(13px,1.2vw,18px)] font-extrabold">
                <Avatar address={p.address} name={p.name} />
                {p.name}
              </PopItem>
            ))}
          </ul>
        </div>
      </div>
    </Appear>
  );
}

/** A question is running: the question, its options, and a countdown you can read from the back of the room. */
function Live({ q, now }: { q: HostQuestion; now: number }) {
  const left = Math.max(0, q.lockAt - now);
  const late = left <= 5;
  return (
    <Appear key={`live-${q.id}`} className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[1.5fr_1fr]">
      <div className="flex min-w-0 flex-col gap-[1.8vw]">
        <p className={`${eyebrow} flex items-center gap-3`}>
          <span className="live-glow inline-block h-[.8em] w-[.8em] rounded-full bg-coral" />
          Question {Number(q.id) + 1} · answer on your phone
        </p>
        <h1 className={`${giant} text-[clamp(30px,5vw,84px)] [text-wrap:balance]`}>{q.text}</h1>
        <ul className="grid grid-cols-2 gap-[1vw]">
          {q.options.map((o, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: EASE_OUT, delay: 0.1 + i * 0.07 }}
              className="flex items-center gap-[1vw] rounded-[clamp(14px,1.4vw,22px)] border border-line bg-surface px-[1.4vw] py-[1.1vw] text-[clamp(16px,2vw,32px)] font-black"
            >
              <span className="h-[1.6em] w-[.34em] shrink-0 rounded-full" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{o}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-center gap-[1vw]">
        <motion.p
          key={late ? left : "calm"}
          initial={late ? { scale: 1.18 } : false}
          animate={{ scale: 1 }}
          transition={POP}
          className={`${giant} text-[clamp(96px,17vw,280px)] tabular-nums ${late ? "text-coral-d" : "text-coral"}`}
          data-testid="screen-clock"
        >
          {left}
        </motion.p>
        <p className="-mt-[.5vw] text-[clamp(14px,1.6vw,24px)] font-extrabold text-ink-2">seconds left</p>
        <div className="mt-[1vw] flex items-center gap-[1.4vw] rounded-[clamp(14px,1.4vw,22px)] border border-line bg-card px-[1.6vw] py-[1vw]">
          <div className="h-[clamp(70px,9vw,140px)] w-[clamp(100px,13vw,200px)]">
            <PotScene coins={Number(q.pot / 10n ** 18n)} />
          </div>
          <div>
            <p className="text-[clamp(12px,1.1vw,16px)] font-black uppercase tracking-wide text-ink-3">In the pot</p>
            <p className={`${giant} text-[clamp(32px,4.4vw,72px)] tabular-nums`}>{coins(q.pot)}</p>
            <div className="mt-2 flex items-center gap-2">
              <AnswerDots answered={q.answerers} of={q.charged} />
            </div>
            <p className="mt-1 text-[clamp(12px,1.1vw,16px)] font-extrabold text-ink-2 tabular-nums">
              {q.answerers} of {q.charged} sealed
            </p>
          </div>
        </div>
      </div>
    </Appear>
  );
}

/** Time is up and the answers are opening on their own: a beat of suspense. */
function TimesUp({ q }: { q: HostQuestion }) {
  return (
    <Appear key={`up-${q.id}`} className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[auto_1fr]">
      <Mascot mood="surprised" size={260} disc className="!h-[clamp(140px,22vw,340px)] !w-[clamp(140px,22vw,340px)]" />
      <div className="min-w-0">
        <p className={eyebrow}>Question {Number(q.id) + 1}</p>
        <h1 className={`${giant} mt-[.6vw] text-[clamp(48px,9vw,150px)]`}>Time&apos;s up!</h1>
        <p className="mt-[1vw] text-[clamp(16px,2.2vw,34px)] font-extrabold text-ink-2 tabular-nums">
          Opening everyone&apos;s answers… {q.revealed} of {q.answerers} open.
        </p>
        <p className="mt-[1.4vw] text-[clamp(16px,2vw,30px)] font-black">{q.text}</p>
      </div>
    </Appear>
  );
}

/** The result is set: how the room answered, which answer was right, and where the pot went. */
function Outcome({ q, paid }: { q: HostQuestion; paid: boolean }) {
  const right = Number(q.outcome);
  const total = q.tally.reduce((a, b) => a + b, 0);
  const voided = q.status === Status.VOIDED;
  return (
    <Appear key={`out-${q.id}`} className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-w-0 flex-col gap-[1.4vw]">
        <p className={eyebrow}>Question {Number(q.id) + 1}</p>
        <h1 className={`${giant} text-[clamp(26px,3.6vw,60px)] [text-wrap:balance]`}>{q.text}</h1>
        <ul className="flex flex-col gap-[.8vw]">
          {q.options.map((o, i) => {
            const won = !voided && i === right;
            const share = total > 0 ? (q.tally[i] ?? 0) / total : 0;
            return (
              <li key={i} className={`relative flex items-center gap-[1vw] overflow-hidden rounded-[clamp(12px,1.2vw,20px)] border-2 px-[1.4vw] py-[.9vw] text-[clamp(16px,1.9vw,30px)] font-black ${won ? "border-gold bg-[#FFF4D6]" : "border-line bg-surface"}`}>
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 opacity-30"
                  style={{ background: won ? "#F2B72B" : OPTION_COLORS[i % OPTION_COLORS.length] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 + i * 0.08 }}
                />
                <span className="relative min-w-0 flex-1 [overflow-wrap:anywhere]">{o}</span>
                {won && <span className="relative rounded-full bg-gold px-[1vw] py-[.2vw] text-[.62em] font-black uppercase tracking-wide">right</span>}
                <span className="relative tabular-nums text-ink-2">{q.tally[i] ?? 0}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col items-center gap-[1vw] text-center">
        <Mascot mood={voided || q.winners === 0 ? "oops" : "happy"} size={200} disc className="!h-[clamp(110px,15vw,240px)] !w-[clamp(110px,15vw,240px)]" />
        {voided ? (
          <p className="text-[clamp(18px,2.4vw,38px)] font-black [text-wrap:balance]">Nobody got it. Everyone&apos;s play went back.</p>
        ) : (
          <>
            <p className="flex items-center gap-[.8vw]">
              <Coin size={36} />
              <span className={`${giant} text-[clamp(56px,8vw,130px)] text-gold-d tabular-nums`} data-testid="screen-pot">
                {coins(q.pot)}
              </span>
            </p>
            <p className="text-[clamp(16px,2vw,32px)] font-black tabular-nums">
              {paid ? "paid to" : "going to"} {q.winners} {q.winners === 1 ? "winner" : "winners"}
            </p>
          </>
        )}
      </div>
    </Appear>
  );
}

/** Between questions: who is ahead. Rows glide when the order changes. */
function Standings({ view, last }: { view: RoomView; last: HostQuestion }) {
  const rows = view.people.map((p, i) => ({ ...p, i })).sort((a, b) => (a.coins === b.coins ? a.i - b.i : a.coins > b.coins ? -1 : 1));
  const top = rows[0]?.coins ?? 0n;
  const leading = rows.length > 1 && rows[0]!.coins > rows[1]!.coins;
  return (
    <Appear key="standings" className="grid flex-1 items-center gap-[4vw] lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot mood="happy" size={220} disc className="!h-[clamp(120px,18vw,280px)] !w-[clamp(120px,18vw,280px)]" />
        <p className="max-w-[18ch] text-[clamp(14px,1.5vw,22px)] font-extrabold text-ink-2 [text-wrap:balance]">Next question is coming. Keep your phone open.</p>
      </div>
      <div className="min-w-0">
        <p className={eyebrow}>After question {Number(last.id) + 1}</p>
        <h1 className={`${giant} mt-[.4vw] text-[clamp(34px,5vw,84px)]`}>Standings</h1>
        <ol className="mt-[1.6vw] flex flex-col gap-[.7vw]" data-testid="screen-standings">
          {rows.slice(0, 8).map((p, i) => (
            <PopItem key={p.address} layout className={`relative flex origin-left items-center gap-[1vw] overflow-hidden rounded-full border px-[.6vw] py-[.5vw] pr-[1.6vw] text-[clamp(15px,1.8vw,28px)] font-black ${i === 0 && leading ? "border-gold bg-[#FFF4D6]" : "border-line bg-surface"}`}>
              <span className="w-[1.6em] text-center text-ink-3 tabular-nums">{i + 1}</span>
              <Avatar address={p.address} name={p.name} size={34} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span aria-hidden="true" className="hidden h-[.5em] w-[18vw] overflow-hidden rounded-full bg-bg-2 md:block">
                <span className="block h-full rounded-full bg-gold transition-[width] duration-700 ease-out" style={{ width: `${top > 0n ? Number((p.coins * 100n) / top) : 0}%` }} />
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                <Coin size={18} />
                {coins(p.coins)}
              </span>
            </PopItem>
          ))}
        </ol>
      </div>
    </Appear>
  );
}

export default function BigScreen() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const now = useNow();
  const roomQ = useQuery({ queryKey: ["room-address", code], queryFn: () => findRoom(code), staleTime: Infinity });
  const room = roomQ.data;
  const viewQ = useQuery({ queryKey: ["room", room, zeroAddress], queryFn: () => readRoom(room as Address, zeroAddress), enabled: !!room, refetchInterval: 2000 });
  const qsQ = useQuery({ queryKey: ["host-questions", room], queryFn: () => readHostQuestions(room as Address), enabled: !!room, refetchInterval: 2000 });
  const view = viewQ.data;
  const list = qsQ.data?.questions;

  const inFlight = list?.find((q) => q.status >= Status.OPEN && q.status <= Status.RESOLVED);
  const finished = list?.filter((q) => q.status === Status.SETTLED || q.status === Status.VOIDED) ?? [];
  const last = finished[finished.length - 1];
  // A question that finishes while this screen is watching keeps the screen for a few seconds (its result),
  // then the standings take over. A screen opened later goes straight to the standings.
  const lastKey = list ? (last ? String(last.id) : "") : undefined;
  const [seen, setSeen] = useState<string | undefined>(undefined);
  const [holdUntil, setHoldUntil] = useState(0);
  if (lastKey !== undefined && lastKey !== seen) {
    setSeen(lastKey);
    if (seen !== undefined && lastKey !== "") setHoldUntil(now + 14);
  }

  let body: React.ReactNode;
  if (room === null || roomQ.isError) {
    body = (
      <Appear className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Mascot mood="oops" size={220} disc />
        <h1 className={`${giant} text-[clamp(30px,5vw,72px)]`}>Room {code} not found.</h1>
      </Appear>
    );
  } else if (!view || !list) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Mascot mood="surprised" size={220} disc />
        <p className="text-[clamp(18px,2.4vw,36px)] font-black">Finding room {code}…</p>
      </div>
    );
  } else {
    if (inFlight?.status === Status.OPEN) body = <Live q={inFlight} now={now} />;
    else if (inFlight && inFlight.status !== Status.RESOLVED) body = <TimesUp q={inFlight} />;
    else if (inFlight) body = <Outcome q={inFlight} paid={false} />;
    else if (last && now < holdUntil) body = <Outcome q={last} paid />;
    else if (last) body = <Standings view={view} last={last} />;
    else body = <Waiting code={code} view={view} />;
  }

  return (
    <main className="flex min-h-[100dvh] flex-col gap-[2vw] px-[clamp(20px,4vw,72px)] py-[clamp(16px,2.4vw,40px)]" data-testid="big-screen">
      <header className="flex items-center justify-between">
        <Logo size={40} />
        <p className="rounded-full border border-line bg-surface px-4 py-2 text-[clamp(12px,1.2vw,18px)] font-extrabold text-ink-2">
          Room <b className="ml-1 tracking-[.14em] text-ink">{code}</b>
        </p>
      </header>
      {body}
    </main>
  );
}
