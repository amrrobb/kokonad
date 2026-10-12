import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, Speed, StepChip } from "../Stage";
import { at } from "../theme";
import { cues, spoken } from "../voice";

const LINES = ["question-open", "question-seal", "question-clock"] as const;
/** Frames at real speed, then the speed of the rest. */
const REAL = 255;
const FAST = 2;
export const QUESTION_FRAMES = spoken(LINES) + 14;
const say = cues(LINES, QUESTION_FRAMES);

/**
 * Question 1 from the moment it opens (T = -6.8) at real speed, then the rest of the countdown at 2x: the
 * clock reaches zero (T = 12) while Koko says the third line.
 */
export const Question: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="3">A question goes live</StepChip>
      <Source />
      <Phone label="Eka's phone" {...PHONE} style={{ left: 60, top: TOP }}>
        <Video
          name="Eka: question, pick, lock"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", -6.8) * fps)}
          durationInFrames={REAL}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          name="Eka: sealed, clock runs out"
          src={staticFile("footage/eka.mp4")}
          from={REAL}
          trimBefore={Math.round(at("eka", 1.7) * fps)}
          durationInFrames={Math.round((QUESTION_FRAMES - REAL) * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={phoneClip}
        />
      </Phone>
      <Screen kind="projector" label="Big screen in the room" {...BIG} delay={5} style={{ left: 540, top: TOP }}>
        <Video
          name="Big screen: question opens"
          src={staticFile("footage/big-screen.mp4")}
          trimBefore={Math.round(at("big", -6.8) * fps)}
          durationInFrames={REAL}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: clock runs out"
          src={staticFile("footage/big-screen.mp4")}
          from={REAL}
          trimBefore={Math.round(at("big", 1.7) * fps)}
          durationInFrames={Math.round((QUESTION_FRAMES - REAL) * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      <Sequence name="Speed tag" from={REAL} layout="none">
        <Speed style={{ left: 1490, top: TOP - 50 }}>{`×${FAST}`}</Speed>
      </Sequence>
      <Koko
        name="Koko: one coin each"
        {...say[0]}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter
        style={{ left: 560, top: 770 }}
      />
      <Koko
        name="Koko: sealed answer"
        {...say[1]}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      />
      <Koko
        name="Koko: clock runs out"
        {...say[2]}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      />
    </Backdrop>
  );
};
