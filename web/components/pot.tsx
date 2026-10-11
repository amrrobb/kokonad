"use client";

/**
 * The flat pot: a coconut bowl that fills as plays go in, and a row of dots for who has answered.
 * This is what phones get (the host's screen has the 3D bowl). Both are pictures of numbers that
 * are printed next to them from the chain; neither is ever the only place a figure is shown.
 */
import { motion } from "motion/react";
import { POP } from "./motion";

/** Where each coin rests, back row first so later coins sit in front. Twelve is a full bowl. */
const SLOTS: Array<[number, number]> = [
  [30, 31], [48, 30], [66, 31], [39, 27], [57, 27],
  [34, 22], [48, 21], [62, 22], [41, 16], [55, 16],
  [48, 11], [48, 5],
];
export const BOWL_FULL = SLOTS.length;

export function PotBowl({ coins, width = 76 }: { coins: number; width?: number }) {
  const shown = Math.max(0, Math.min(BOWL_FULL, Math.floor(coins)));
  return (
    <svg viewBox="0 0 96 82" width={width} height={(width * 82) / 96} aria-hidden="true" data-testid="pot-bowl" data-coins={shown} className="shrink-0 overflow-visible">
      <ellipse cx="48" cy="78" rx="30" ry="3.5" fill="#3B1F14" opacity=".08" />
      {/* the inside of the bowl, behind the coins */}
      <ellipse cx="48" cy="36" rx="40" ry="11" fill="#FFF3E3" stroke="#6E4329" strokeWidth="2" />
      {SLOTS.slice(0, shown).map(([x, y], i) => (
        <motion.g key={i} initial={{ opacity: 0, y: -34 }} animate={{ opacity: 1, y: 0 }} transition={{ ...POP, delay: Math.min(i, 6) * 0.04 }}>
          <ellipse cx={x} cy={y + 2.2} rx="8" ry="3.6" fill="#D99A12" />
          <ellipse cx={x} cy={y} rx="8" ry="3.6" fill="#F2B72B" />
          <ellipse cx={x - 2} cy={y - 0.8} rx="3.2" ry="1.1" fill="#FFE38A" />
        </motion.g>
      ))}
      {/* the front of the shell, in front of the coins */}
      <path d="M8 36 Q8 78 48 78 Q88 78 88 36 Q88 47 48 47 Q8 47 8 36 Z" fill="#8A5A3C" />
      <path d="M8 36 Q8 47 48 47 Q88 47 88 36" fill="none" stroke="#6E4329" strokeWidth="2" />
      <path d="M20 58 q4 8 12 12 M30 54 q3 7 9 11" fill="none" stroke="#A9744F" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/** One dot per person playing this question; a dot fills the moment their answer is sealed. Never says what they picked. */
export function AnswerDots({ answered, of }: { answered: number; of: number }) {
  const total = Math.max(0, Math.min(of, 24));
  const filled = Math.min(answered, total);
  return (
    <span className="flex flex-wrap items-center gap-1.5" aria-hidden="true" data-testid="answer-dots" data-answered={answered}>
      {Array.from({ length: total }, (_, i) =>
        i < filled ? (
          <motion.span key={`on-${i}`} className="h-3 w-3 rounded-full bg-coral" initial={{ scale: 0.2 }} animate={{ scale: 1 }} transition={POP} />
        ) : (
          <span key={`off-${i}`} className="h-3 w-3 rounded-full border-2 border-[#E9D5C6] bg-surface" />
        ),
      )}
      {of > total && <span className="text-[11px] font-black text-ink-3">+{of - total}</span>}
    </span>
  );
}
