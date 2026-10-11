"use client";

/**
 * The coconut, as a character. Four drawn poses exist (DESIGN.md §6) and no face is ever drawn in code:
 * this only chooses which pose a moment gets, and how it arrives and idles. A change of pose is a change
 * of state, so the new pose pops in (enter only); between changes it breathes, nods or hops in place.
 */
import Image from "next/image";
import { motion } from "motion/react";
import { POP } from "./motion";

export type Mood = "surprised" | "happy" | "oops" | "sleepy";

const IDLE: Record<Mood, string> = { surprised: "nod", happy: "hop", oops: "breathe", sleepy: "breathe" };

export function Mascot({ mood, size, disc = false, className = "", priority = false }: { mood: Mood; size: number; disc?: boolean; className?: string; priority?: boolean }) {
  return (
    <span className={`relative grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }} data-testid="mascot" data-mood={mood} aria-hidden="true">
      {disc && <span className="absolute h-[86%] w-[86%] translate-x-[3%] translate-y-[3%] rounded-full bg-peach" />}
      <motion.span key={mood} className="relative block h-full w-full" initial={{ scale: 0.72, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={POP}>
        <Image src={`/mascot/mascot-${mood}.png`} alt="" width={size * 2} height={size * 2} sizes={`${size}px`} priority={priority} className={`${IDLE[mood]} h-full w-full object-contain`} />
      </motion.span>
    </span>
  );
}
