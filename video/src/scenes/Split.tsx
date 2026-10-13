import type React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { Backdrop, StepChip } from "../Stage";
import { C } from "../theme";
import { cues, LEAD, spoken, voiceFrames } from "../voice";

const LINES = ["split-in", "split-out"] as const;
export const SPLIT_FRAMES = spoken(LINES) + 26;
const say = cues(LINES, SPLIT_FRAMES);

type Outcome = "right" | "wrong" | "out";
const PLAYERS: readonly { readonly name: string; readonly tint: string; readonly outcome: Outcome }[] = [
  { name: "Ayu", tint: "#bfe3d6", outcome: "right" },
  { name: "Bima", tint: "#d9cdf3", outcome: "wrong" },
  { name: "Citra", tint: "#ffd9c2", outcome: "right" },
  { name: "Dewi", tint: "#cfe0f7", outcome: "out" },
  { name: "Edo", tint: "#f7e3a8", outcome: "right" },
  { name: "Fani", tint: "#f5cfdc", outcome: "wrong" },
];
const WINNERS = PLAYERS.flatMap((p, i) => (p.outcome === "right" ? [i] : []));
/** What Room._settle does with no host seed: (pot - seed) / winners, one play of one coin from each player. */
const POT = PLAYERS.length;
const SHARE = POT / WINNERS.length;
if (!Number.isInteger(SHARE)) throw new Error("Pick numbers that divide: the contract would leave the remainder for the next pot.");

const seat = (i: number) => ({ x: 235 + i * 290, y: 250 });
const BOWL = { x: 960, y: 560 };

/** One play from each player, a moment into the first line. */
const IN = say[0].from + LEAD + Math.round(voiceFrames("split-in") * 0.45);
const IN_FLIGHT = 16;
const landed = (i: number) => IN + i * 4 + IN_FLIGHT;
/** Who was right, as the second line starts; the pot goes out as Koko says "each takes two". */
const MARK = say[1].from + LEAD;
const OUT = MARK + Math.round(voiceFrames("split-out") * 0.36);
const OUT_FLIGHT = 18;
const leaves = (w: number, c: number) => OUT + w * 8 + c * 4;
const NOTHING = MARK + Math.round(voiceFrames("split-out") * 0.68);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pop = (frame: number, at: number) => ({
  opacity: interpolate(frame, [at, at + 6], [0, 1], clamp),
  scale: interpolate(frame, [at, at + 10], [0.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)), output: "perceptual-scale" }),
});

const Coin: React.FC<{ readonly x: number; readonly y: number; readonly size?: number }> = ({ x, y, size = 46 }) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: C.gold,
      border: "4px solid #d99a12",
      boxShadow: "inset 0 -5px 0 rgba(160,105,0,.28), inset 0 4px 0 rgba(255,255,255,.45), 0 4px 8px rgba(59,31,20,.18)",
    }}
  />
);

/** A coin on its way between two points, on a small arc. Drawn only while it is in the air. */
const Flight: React.FC<{
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
  readonly start: number;
  readonly length: number;
}> = ({ from, to, start, length }) => {
  const frame = useCurrentFrame();
  if (frame < start || frame >= start + length) return null;
  const t = interpolate(frame, [start, start + length], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return <Coin x={from.x + (to.x - from.x) * t} y={from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 70} />;
};

const PILL: Record<Outcome, { readonly label: string; readonly color: string; readonly bg: string }> = {
  right: { label: "Right", color: "#fff", bg: C.green },
  wrong: { label: "Wrong", color: "#fff", bg: C.coral },
  out: { label: "Sat out", color: C.ink2, bg: C.bg2 },
};

/** Where the coins in the bowl sit: four along the bottom, two on top. The last ones in are the first out. */
const PILE = [
  [-69, 0],
  [-23, 6],
  [23, 6],
  [69, 0],
  [-46, -38],
  [0, -34],
  [46, -38],
  [-23, -74],
] as const;

/**
 * An illustration, not a recording: the recorded game had one winner, so nobody shares a pot in it. Six
 * players put in one coin each; three are right and take two each; the two who were wrong and the one who
 * sat out take nothing. The figures follow Room._settle.
 */
export const Split: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const paidIn = PLAYERS.filter((_, i) => frame >= landed(i)).length;
  const paidOut = WINNERS.reduce((sum, _, w) => sum + Array.from({ length: SHARE }).filter((__, c) => frame >= leaves(w, c)).length, 0);
  const inPot = paidIn - paidOut;

  return (
    <Backdrop>
      <StepChip step="5">The pot is split: a bigger room</StepChip>
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 28,
          padding: "6px 20px",
          borderRadius: 999,
          backgroundColor: C.ink,
          color: "#fff",
          fontWeight: 900,
          fontSize: 24,
        }}
      >
        Illustration, not a recording
      </div>

      {PLAYERS.map((p, i) => {
        const { x, y } = seat(i);
        const w = WINNERS.indexOf(i);
        const got = w >= 0 ? Array.from({ length: SHARE }).filter((_, c) => frame >= leaves(w, c) + OUT_FLIGHT).length : 0;
        const lost = w < 0 && frame >= NOTHING;
        return (
          <div key={p.name} style={{ position: "absolute", left: x - 130, top: y - 70, width: 260, textAlign: "center", ...pop(frame, 4 + i * 3) }}>
            <div
              style={{
                margin: "0 auto",
                width: 140,
                height: 140,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                backgroundColor: p.tint,
                border: `5px solid ${C.ink}`,
                fontWeight: 900,
                fontSize: 52,
                opacity: lost ? 0.5 : 1,
              }}
            >
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ marginTop: 10, fontWeight: 900, fontSize: 34 }}>{p.name}</div>
            <div
              style={{
                display: "inline-block",
                marginTop: 6,
                padding: "4px 20px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 26,
                color: PILL[p.outcome].color,
                backgroundColor: PILL[p.outcome].bg,
                ...pop(frame, MARK + i * 2),
              }}
            >
              {PILL[p.outcome].label}
            </div>
            {w >= 0 ? (
              <div style={{ marginTop: 4, fontWeight: 900, fontSize: 56, color: C.green, ...pop(frame, leaves(w, 0) + OUT_FLIGHT) }}>+{got}</div>
            ) : (
              <div style={{ marginTop: 4, fontWeight: 900, fontSize: 56, color: C.ink3, ...pop(frame, NOTHING + i * 2) }}>0</div>
            )}
          </div>
        );
      })}

      {/* The pot: coins pile up above the rim of a bowl, and the number on it is how many are inside. */}
      {PILE.slice(0, inPot).map(([dx, dy]) => (
        <Coin key={`${dx}:${dy}`} x={BOWL.x + dx} y={BOWL.y - 6 + dy} />
      ))}
      <div
        style={{
          position: "absolute",
          left: BOWL.x - 170,
          top: BOWL.y,
          width: 340,
          height: 150,
          borderRadius: "24px 24px 170px 170px / 24px 24px 150px 150px",
          backgroundColor: C.coral,
          boxShadow: `inset 0 -14px 0 ${C.coralD}, 0 18px 30px rgba(59,31,20,.18)`,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontWeight: 900,
          fontSize: 76,
          ...pop(frame, 2),
        }}
      >
        {inPot}
      </div>
      <div
        style={{
          position: "absolute",
          left: BOWL.x - 170,
          top: BOWL.y + 158,
          width: 340,
          textAlign: "center",
          fontWeight: 900,
          fontSize: 28,
          color: C.ink2,
        }}
      >
        coins in the pot
      </div>

      {PLAYERS.map((p, i) => (
        <Flight key={`in-${p.name}`} from={seat(i)} to={{ x: BOWL.x, y: BOWL.y - 40 }} start={IN + i * 4} length={IN_FLIGHT} />
      ))}
      {WINNERS.flatMap((i, w) =>
        Array.from({ length: SHARE }, (_, c) => (
          <Flight
            key={`out-${i}-${c}`}
            from={{ x: BOWL.x, y: BOWL.y - 40 }}
            to={{ x: seat(i).x, y: seat(i).y + 190 }}
            start={leaves(w, c)}
            length={OUT_FLIGHT}
          />
        )),
      )}

      <div
        style={{ position: "absolute", left: 1210, top: BOWL.y + 34, width: 640, fontWeight: 900, fontSize: 44, lineHeight: 1.2, ...pop(frame, OUT) }}
      >
        {POT} coins ÷ {WINNERS.length} right
        <br />
        <span style={{ color: C.green }}>= {SHARE} each</span>
      </div>

      <Koko
        name="Koko: six coins in"
        {...say[0]}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={230}
        bubbleWidth={920}
        fontSize={44}
        enter
        style={{ left: 120, top: 800 }}
      />
      <Koko
        name="Koko: three share it"
        {...say[1]}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={230}
        bubbleWidth={920}
        fontSize={44}
        enter={false}
        style={{ left: 120, top: 800 }}
      />
    </Backdrop>
  );
};
