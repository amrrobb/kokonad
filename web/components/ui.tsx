"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { formatUnits } from "viem";
import { Logo } from "./brand";
import { Mascot, type Mood } from "./mascot";
import { Appear, POP } from "./motion";

const AVATAR = ["#B9A2F0", "#F7C948", "#FFB08F", "#F9A8C9", "#7CC1F5", "#A8E6CF", "#9AD0CC", "#FFD1BA"];

/** Coins are 18-decimal KOKO; show them like money people count, e.g. 20 or 23.2. */
export function coins(wei: bigint): string {
  const n = Number(formatUnits(wei, 18));
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function Avatar({ address, name, size = 28 }: { address: string; name: string; size?: number }) {
  const h = parseInt(address.slice(2, 10), 16);
  const initials = (name.trim() || "?").slice(0, 2).toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-black text-ink" style={{ background: AVATAR[h % AVATAR.length], width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials}
    </span>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col px-5 pb-5 pt-4">{children}</main>;
}

/** A gold coin, drawn the same everywhere a coin stands for coins. */
export function Coin({ size = 14 }: { size?: number }) {
  return <span aria-hidden="true" className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: "radial-gradient(circle at 35% 35%, #FFE38A, #F2B72B 55%, #D99A12)" }} />;
}

/**
 * Top of every participant screen: the mark, the room, the balance. The figure is the chain's and is
 * never counted up; when it changes, the pill itself gives one small bump so the change is noticed.
 */
export function RoomHeader({ code, balance }: { code: string; balance?: bigint }) {
  const shown = balance === undefined ? "0" : coins(balance);
  return (
    <header className="flex items-center gap-2.5">
      <Logo size={30} word={false} />
      <p className="mr-auto rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-extrabold text-ink-2">
        Room <b className="ml-0.5 tracking-[.12em] text-ink">{code}</b>
      </p>
      <motion.span
        key={shown}
        data-balance-pill
        initial={balance === undefined ? false : { scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={POP}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] font-black tabular-nums"
      >
        <Coin />
        {shown}
      </motion.span>
    </header>
  );
}

export function PrimaryButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{ "--ledge": "var(--color-coral-d)" } as React.CSSProperties}
      className="ledge w-full rounded-full bg-coral py-4 text-[16px] font-black text-white hover:bg-coral-d disabled:bg-bg-2 disabled:text-ink-3"
    >
      {props.children}
    </button>
  );
}

/**
 * A quiet moment with nothing to press: the coconut in the pose that fits, a headline, one line.
 * Used for waiting, missing rooms and cancelled questions, so an empty screen is never just text.
 */
export function Moment({ mood, title, body, children, size = 148, level = 2 }: { mood: Mood; title: string; body?: string; children?: ReactNode; size?: number; level?: 1 | 2 }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <Appear className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
      <Mascot mood={mood} size={size} disc />
      <H className="mt-2 text-[24px] font-black leading-[1.15] tracking-[-.015em] [text-wrap:balance]">{title}</H>
      {body && <p className="max-w-[30ch] font-extrabold text-ink-2 [text-wrap:pretty]">{body}</p>}
      {children}
    </Appear>
  );
}
