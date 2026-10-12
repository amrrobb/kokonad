import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import { HostSetup, HOST_SETUP_FRAMES } from "./scenes/HostSetup";
import { Intro, INTRO_FRAMES } from "./scenes/Intro";
import { Join, JOIN_FRAMES } from "./scenes/Join";
import { Monad, MONAD_FRAMES } from "./scenes/Monad";
import { Outro, OUTRO_FRAMES } from "./scenes/Outro";
import { Payout, PAYOUT_FRAMES } from "./scenes/Payout";
import { Question, QUESTION_FRAMES } from "./scenes/Question";
import { Result, RESULT_FRAMES } from "./scenes/Result";
import { Reveal, REVEAL_FRAMES } from "./scenes/Reveal";
import { LEAD, voiceFrames } from "./voice";

const FADE = 12;
const SCENES = [
  INTRO_FRAMES,
  HOST_SETUP_FRAMES,
  JOIN_FRAMES,
  QUESTION_FRAMES,
  REVEAL_FRAMES,
  RESULT_FRAMES,
  PAYOUT_FRAMES,
  MONAD_FRAMES,
  OUTRO_FRAMES,
];
/** Every scene is as long as its lines take to say; the fades between them overlap. */
export const DEMO_FRAMES = SCENES.reduce((sum, frames) => sum + frames, 0) - FADE * (SCENES.length - 1);

/** The music sits well under Koko's voice, comes up once the last line is said, and fades with the picture. */
const LAST_WORD = DEMO_FRAMES - OUTRO_FRAMES + LEAD + voiceFrames("outro-try");
const music = (frame: number): number =>
  interpolate(frame, [0, 12, LAST_WORD, LAST_WORD + 20, DEMO_FRAMES - 26, DEMO_FRAMES - 1], [0, 0.17, 0.17, 0.45, 0.45, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * The demo, scene by scene. Each scene is also registered on its own in Root.tsx, so it can be opened and
 * edited alone in Studio.
 */
export const Demo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio name="Music" src={staticFile("music/bgm.mp3")} volume={music} />
      <TransitionSeries name="Demo">
        <TransitionSeries.Sequence name="Intro" durationInFrames={INTRO_FRAMES} premountFor={fps}>
          <Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="1 Host opens a room" durationInFrames={HOST_SETUP_FRAMES} premountFor={fps}>
          <HostSetup />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="2 Players join" durationInFrames={JOIN_FRAMES} premountFor={fps}>
          <Join />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="3 Question live" durationInFrames={QUESTION_FRAMES} premountFor={fps}>
          <Question />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="4 Answers open, result set" durationInFrames={REVEAL_FRAMES} premountFor={fps}>
          <Reveal />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="5 Pot is split" durationInFrames={RESULT_FRAMES} premountFor={fps}>
          <Result />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="6 Dispute window, payout" durationInFrames={PAYOUT_FRAMES} premountFor={fps}>
          <Payout />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="7 On Monad" durationInFrames={MONAD_FRAMES} premountFor={fps}>
          <Monad />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
        <TransitionSeries.Sequence name="Outro" durationInFrames={OUTRO_FRAMES} premountFor={fps}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
