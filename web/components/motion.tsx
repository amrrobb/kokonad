"use client";

/**
 * Motion for the React screens (DESIGN.md §4). Three rules are built in here so call sites cannot
 * forget them: everything animates IN only (a leaving node that stays mounted is a second button),
 * transforms are dropped for people who ask for less motion, and nothing here touches a number.
 */
import { MotionConfig, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export const EASE_OUT = [0.25, 1, 0.5, 1] as const;
/** People and coins arrive with a soft spring; everything else eases. */
export const POP = { type: "spring", stiffness: 520, damping: 26, mass: 0.7 } as const;

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** A screen or block arriving. Give it a `key` when the same slot shows a different thing. */
export function Appear({ children, className, delay = 0, style }: { children: ReactNode; className?: string; delay?: number; style?: CSSProperties }) {
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE_OUT, delay }}>
      {children}
    </motion.div>
  );
}

/**
 * One row of a list arriving in turn. Stagger is capped so a long list is never a long wait.
 * `opacity` is where the row ends up: a dimmed row passes it here, because the animated value
 * would otherwise override a dimming class.
 */
export function RiseItem({ children, className, i = 0, opacity = 1, ...rest }: { children: ReactNode; className?: string; i?: number; opacity?: number } & Record<`data-${string}`, string | undefined>) {
  return (
    <motion.li className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity, y: 0 }} transition={{ duration: 0.28, ease: EASE_OUT, delay: Math.min(i, 8) * 0.05 }} {...rest}>
      {children}
    </motion.li>
  );
}

/** A person arriving in the room. With `layout`, the row also glides to its new place when the order changes. */
export function PopItem({ children, className, layout = false }: { children: ReactNode; className?: string; layout?: boolean }) {
  return (
    <motion.li layout={layout ? "position" : false} className={className} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={POP}>
      {children}
    </motion.li>
  );
}
