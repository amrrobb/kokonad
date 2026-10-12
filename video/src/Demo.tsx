import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { useVideoConfig } from "remotion";
import { HostSetup } from "./scenes/HostSetup";
import { Intro } from "./scenes/Intro";
import { Join } from "./scenes/Join";
import { Monad } from "./scenes/Monad";
import { Outro } from "./scenes/Outro";
import { Payout } from "./scenes/Payout";
import { Question } from "./scenes/Question";
import { Result } from "./scenes/Result";
import { Reveal } from "./scenes/Reveal";

/**
 * The demo, scene by scene. Each scene is also registered on its own in Root.tsx, so it can be opened and
 * edited alone in Studio. Eight 12-frame fades overlap the scenes: 2790 - 96 = 2694 frames (89.8 s).
 */
export const Demo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries name="Demo">
      <TransitionSeries.Sequence name="Intro" durationInFrames={210} premountFor={fps}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="1 Host opens a room" durationInFrames={360} premountFor={fps}>
        <HostSetup />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="2 Players join" durationInFrames={330} premountFor={fps}>
        <Join />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="3 Question live" durationInFrames={420} premountFor={fps}>
        <Question />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="4 Answers open, result set" durationInFrames={270} premountFor={fps}>
        <Reveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="5 Pot is split" durationInFrames={300} premountFor={fps}>
        <Result />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="6 Dispute window, payout" durationInFrames={330} premountFor={fps}>
        <Payout />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="7 On Monad" durationInFrames={390} premountFor={fps}>
        <Monad />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
      <TransitionSeries.Sequence name="Outro" durationInFrames={180} premountFor={fps}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
