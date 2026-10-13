import { Audio, Video } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, BuiltOnMonad, Phone, Screen, Source } from "../Stage";
import { at, C } from "../theme";
import { cues, LEAD, spoken, voiceFrames, type LineId } from "../voice";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pop = (frame: number, start: number) => ({
  opacity: interpolate(frame, [start, start + 8], [0, 1], clamp),
  translate: interpolate(frame, [start, start + 14], ["0px 28px", "0px 0px"], { ...clamp, easing: Easing.out(Easing.cubic) }),
});
/** The frame at which a share of a line has been spoken, counted from the start of its scene. */
const during = (say: readonly { readonly from: number; readonly line: LineId }[], i: number, share: number) =>
  say[i].from + LEAD + Math.round(voiceFrames(say[i].line) * share);

/** Top-left label: which part of the pitch this is. */
const Part: React.FC<{ readonly children: string }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      left: 60,
      top: 18,
      padding: "5px 24px",
      borderRadius: 999,
      backgroundColor: C.coral,
      color: "#fff",
      fontWeight: 900,
      fontSize: 28,
    }}
  >
    {children}
  </div>
);

const Card: React.FC<{
  readonly start: number;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}> = ({ start, title, children, style }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        padding: "26px 34px",
        borderRadius: 28,
        backgroundColor: C.surface,
        border: `3px solid ${C.ink}`,
        boxShadow: `0 8px 0 ${C.ink}`,
        ...pop(frame, start),
        ...style,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 26, letterSpacing: "0.06em", textTransform: "uppercase", color: C.coralD }}>{title}</div>
      <div style={{ marginTop: 8, fontWeight: 800, fontSize: 40, lineHeight: 1.2 }}>{children}</div>
    </div>
  );
};

/** Koko on the right, as in the demo's result scene: one instance per line. */
const Guide: React.FC<{ readonly say: ReturnType<typeof cues>; readonly moods: readonly ("surprised" | "happy" | "oops" | "sleepy")[] }> = ({
  say,
  moods,
}) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {say.map((cue, i) => (
        <Koko
          key={cue.line}
          name={`Koko: ${cue.line}`}
          {...cue}
          premountFor={fps}
          mood={moods[i]}
          layout="stack"
          size={320}
          bubbleWidth={500}
          fontSize={40}
          enter={i === 0}
          style={{ left: 1362, top: 120, width: 500, height: 900, justifyContent: "flex-end" }}
        />
      ))}
    </>
  );
};

// ── 1. Who ────────────────────────────────────────────────────────────────────────────────────────────
const WHO = ["pitch-hello", "pitch-team"] as const;
const WHO_FRAMES = spoken(WHO) + 14;
const who = cues(WHO, WHO_FRAMES);

const Who: React.FC = () => {
  const frame = useCurrentFrame();
  const team = who[1].from + LEAD;
  return (
    <Backdrop>
      <div style={{ position: "absolute", left: 60, top: 60, display: "flex", alignItems: "center", gap: 20, ...pop(frame, 0) }}>
        <Img src={staticFile("mascot/logo-512.png")} style={{ width: 96, height: 96 }} />
        <span style={{ fontWeight: 900, fontSize: 92, letterSpacing: "-0.03em" }}>Kokonad</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 190,
          width: 1240,
          fontWeight: 800,
          fontSize: 44,
          lineHeight: 1.2,
          color: C.ink2,
          ...pop(frame, 6),
        }}
      >
        Live guessing games for community events, where the prize pot settles itself.
      </div>
      <Card start={team} title="The team" style={{ position: "absolute", left: 60, top: 380, width: 1240 }}>
        One builder, solo.
        <div style={{ marginTop: 14, fontSize: 34, color: C.ink2, lineHeight: 1.35 }}>
          Member of DevWeb3Jogja, a web3 community in Yogyakarta, Indonesia
          <br />
          github.com/amrrobb/kokonad
        </div>
      </Card>
      <div style={{ position: "absolute", left: 60, top: 720, fontWeight: 800, fontSize: 32, color: C.ink3, ...pop(frame, team + 20) }}>
        Monad Metropolis · Track 03, Social, Attention &amp; Culture
      </div>
      <div style={{ position: "absolute", left: 60, top: 800, ...pop(frame, team + 26) }}>
        <BuiltOnMonad height={44} />
      </div>
      <Guide say={who} moods={["happy", "surprised"]} />
    </Backdrop>
  );
};

// ── 2. The problem ────────────────────────────────────────────────────────────────────────────────────
const PROBLEM = ["pitch-problem-1", "pitch-problem-2", "pitch-problem-3"] as const;
const PROBLEM_FRAMES = spoken(PROBLEM) + 12;
const problem = cues(PROBLEM, PROBLEM_FRAMES);

const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Backdrop>
      <Part>The problem</Part>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 130,
          width: 1240,
          fontWeight: 900,
          fontSize: 68,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          ...pop(frame, 4),
        }}
      >
        Every event runs a game.
        <br />
        The prize is the awkward part.
      </div>
      <div style={{ position: "absolute", left: 60, top: 350, width: 1240, display: "flex", flexDirection: "column", gap: 26 }}>
        <Card start={during(problem, 1, 0)} title="1">
          Someone checks the answers by hand
        </Card>
        <Card start={during(problem, 1, 0.36)} title="2">
          Someone holds the money
        </Card>
        <Card start={during(problem, 1, 0.66)} title="3">
          Someone forgets to pay
        </Card>
        <Card start={during(problem, 2, 0)} title="And">
          A quiz only asks what somebody already knows
        </Card>
      </div>
      <Guide say={problem} moods={["sleepy", "oops", "oops"]} />
    </Backdrop>
  );
};

// ── 3. What Kokonad does: footage of the recorded game ────────────────────────────────────────────────
const SOLUTION = ["pitch-solution-1", "pitch-solution-2"] as const;
const SOLUTION_FRAMES = spoken(SOLUTION) + 40;
const solution = cues(SOLUTION, SOLUTION_FRAMES);
/** Question 1 from just before Eka picks; then, as Koko says "the contract pays", the moment the coins land. */
const PAY = during(solution, 1, 0.42);

const Solution: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <Part>What Kokonad does</Part>
      <Source />
      <Phone label="A player's phone" {...PHONE} style={{ left: 60, top: TOP }}>
        <Video
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", -5.5) * fps)}
          durationInFrames={PAY}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          src={staticFile("footage/eka.mp4")}
          from={PAY}
          trimBefore={Math.round(at("eka", 81.6) * fps)}
          durationInFrames={SOLUTION_FRAMES - PAY}
          premountFor={fps}
          muted
          style={phoneClip}
        />
      </Phone>
      <Screen kind="projector" label="Big screen in the room" {...BIG} delay={5} style={{ left: 540, top: TOP }}>
        <Video
          src={staticFile("footage/big-screen.mp4")}
          trimBefore={Math.round(at("big", -5.5) * fps)}
          durationInFrames={PAY}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          src={staticFile("footage/big-screen.mp4")}
          from={PAY}
          trimBefore={Math.round(at("big", 81.6) * fps)}
          durationInFrames={SOLUTION_FRAMES - PAY}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      {solution.map((cue, i) => (
        <Koko
          key={cue.line}
          name={`Koko: ${cue.line}`}
          {...cue}
          premountFor={fps}
          mood={i === 0 ? "surprised" : "happy"}
          layout="row"
          size={250}
          bubbleWidth={980}
          fontSize={44}
          enter={i === 0}
          style={{ left: 560, top: 770 }}
        />
      ))}
    </Backdrop>
  );
};

// ── 4. Why Monad ──────────────────────────────────────────────────────────────────────────────────────
const MONAD = ["pitch-monad-1", "pitch-monad-2"] as const;
const MONAD_FRAMES = spoken(MONAD) + 14;
const monad = cues(MONAD, MONAD_FRAMES);

const Figure: React.FC<{ readonly start: number; readonly figure: string; readonly unit?: string; readonly children: string }> = ({
  start,
  figure,
  unit,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        flex: 1,
        padding: "30px 30px 34px",
        borderRadius: 28,
        backgroundColor: C.surface,
        border: `3px solid ${C.ink}`,
        boxShadow: `0 8px 0 ${C.ink}`,
        ...pop(frame, start),
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 96, letterSpacing: "-0.03em", color: C.coralD, lineHeight: 1 }}>
        {figure}
        {unit ? <span style={{ marginLeft: 12, fontSize: 46, letterSpacing: 0 }}>{unit}</span> : null}
      </div>
      <div style={{ marginTop: 14, fontWeight: 800, fontSize: 32, lineHeight: 1.2, color: C.ink2 }}>{children}</div>
    </div>
  );
};

const WhyMonad: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Backdrop>
      <Part>Why Monad</Part>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 130,
          width: 1240,
          fontWeight: 900,
          fontSize: 68,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          ...pop(frame, 4),
        }}
      >
        A game is dozens of
        <br />
        tiny transactions.
      </div>
      <div style={{ position: "absolute", left: 60, top: 360, width: 1240, display: "flex", gap: 26 }}>
        <Figure start={during(monad, 0, 0.5)} figure="23">
          transactions in one full game
        </Figure>
        <Figure start={during(monad, 0, 0.72)} figure="0.97" unit="MON">
          gas for all of them, paid by a relayer
        </Figure>
        <Figure start={during(monad, 1, 0)} figure="0" unit="MON">
          held by the players and the host
        </Figure>
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 700,
          width: 1240,
          fontWeight: 800,
          fontSize: 30,
          lineHeight: 1.3,
          color: C.ink3,
          ...pop(frame, during(monad, 0, 0.5)),
        }}
      >
        Room RN2U3C on kokonad.robbyn.xyz, 12 Oct 2026: 3 players, 2 questions.
        <br />
        The players were test browsers, not people.
      </div>
      <div style={{ position: "absolute", left: 60, top: 850, ...pop(frame, during(monad, 1, 0.2)) }}>
        <BuiltOnMonad height={54} />
      </div>
      <Guide say={monad} moods={["surprised", "happy"]} />
    </Backdrop>
  );
};

// ── 5. First users, how to reach them, where it stands ────────────────────────────────────────────────
const NEXT = ["pitch-users-1", "pitch-users-2", "pitch-status", "pitch-outro"] as const;
const NEXT_FRAMES = spoken(NEXT) + 60;
const next = cues(NEXT, NEXT_FRAMES);

const Next: React.FC = () => {
  const frame = useCurrentFrame();
  const out = next[3].from;
  return (
    <Backdrop>
      <Part>Who it is for, and what comes next</Part>
      <div style={{ position: "absolute", left: 60, top: 130, width: 1240, display: "flex", flexDirection: "column", gap: 26 }}>
        <Card start={next[0].from + LEAD} title="First users">
          People who run small community events: meetups, watch parties, campus clubs. First of all, DevWeb3Jogja.
        </Card>
        <Card start={next[1].from + LEAD} title="How we reach them">
          A session needs a link and a shared screen. Everyone who scans the code has seen how to host one.
        </Card>
        <Card start={next[2].from + LEAD} title="Where it stands">
          Live on Monad testnet. Players so far: test browsers. Next: the first rooms with real people.
        </Card>
      </div>
      <div style={{ position: "absolute", left: 60, top: 880, display: "flex", alignItems: "center", gap: 40, ...pop(frame, out) }}>
        <div
          style={{
            padding: "16px 36px",
            borderRadius: 999,
            backgroundColor: C.coral,
            boxShadow: `0 8px 0 ${C.coralD}`,
            color: "#fff",
            fontWeight: 900,
            fontSize: 52,
          }}
        >
          kokonad.robbyn.xyz
        </div>
        <BuiltOnMonad height={46} />
      </div>
      <Guide say={next} moods={["happy", "surprised", "sleepy", "happy"]} />
    </Backdrop>
  );
};

const FADE = 12;
const SCENES = [WHO_FRAMES, PROBLEM_FRAMES, SOLUTION_FRAMES, MONAD_FRAMES, NEXT_FRAMES];
export const PITCH_FRAMES = SCENES.reduce((sum, frames) => sum + frames, 0) - FADE * (SCENES.length - 1);
const LAST_WORD = PITCH_FRAMES - NEXT_FRAMES + next[3].from + LEAD + voiceFrames("pitch-outro");
const music = (frame: number): number =>
  interpolate(frame, [0, 12, LAST_WORD, LAST_WORD + 20, PITCH_FRAMES - 26, PITCH_FRAMES - 1], [0, 0.17, 0.17, 0.45, 0.45, 0], clamp);

/** The pitch: who built Kokonad, the problem, what it does, why Monad, who it is for and where it stands. */
export const Pitch: React.FC = () => {
  const { fps } = useVideoConfig();
  const parts: readonly [string, number, React.FC][] = [
    ["Who", WHO_FRAMES, Who],
    ["The problem", PROBLEM_FRAMES, Problem],
    ["What Kokonad does", SOLUTION_FRAMES, Solution],
    ["Why Monad", MONAD_FRAMES, WhyMonad],
    ["First users and status", NEXT_FRAMES, Next],
  ];
  return (
    <>
      <Audio name="Music" src={staticFile("music/bgm.mp3")} volume={music} />
      <TransitionSeries name="Pitch">
        {parts.flatMap(([name, frames, Scene], i) => [
          ...(i > 0
            ? [<TransitionSeries.Transition key={`fade-${name}`} presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />]
            : []),
          <TransitionSeries.Sequence key={name} name={name} durationInFrames={frames} premountFor={fps}>
            <Scene />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
    </>
  );
};
