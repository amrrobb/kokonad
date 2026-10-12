import { loadFont } from "@remotion/google-fonts/Nunito";

export const { fontFamily } = loadFont("normal", {
  weights: ["700", "800", "900"],
  subsets: ["latin"],
});

/** The app's own tokens (web/app/globals.css). */
export const C = {
  bg: "#fbf3ea",
  bg2: "#f6e9db",
  card: "#fff9f3",
  surface: "#ffffff",
  line: "rgba(59, 31, 20, 0.10)",
  ink: "#3b1f14",
  ink2: "#7a5a4c",
  ink3: "#a88c7e",
  coral: "#ff6b4a",
  coralD: "#e85a3a",
  peach: "#ffe3d2",
  gold: "#f2b72b",
  green: "#3c9d5d",
} as const;

/**
 * The five recordings are one game (room RN2U3C, public site, 12 Oct 2026), but each started when its
 * own tab opened. SYNC is the second in each clip at which question 1's countdown showed 12, read off
 * the digits on screen. `at(clip, T)` is the clip second for a moment T seconds after that; question 1
 * opens around T = -7, answers lock at T = 12, the result is set near T = 19 and paid near T = 83.
 */
export const SYNC = {
  big: 49.2,
  eka: 40.6,
  fajar: 36.6,
  gita: 25.6,
  host: 73.2,
} as const;

export const at = (clip: keyof typeof SYNC, T: number): number => SYNC[clip] + T;

export type Mood = "surprised" | "happy" | "oops" | "sleepy";
