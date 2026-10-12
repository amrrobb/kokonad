import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, Speed, StepChip } from "../Stage";
import { at } from "../theme";
import { cues, FPS, spoken } from "../voice";

const LINES = ["question-open", "question-seal", "question-clock"] as const;
export const QUESTION_FRAMES = spoken(LINES) + 14;
const say = cues(LINES, QUESTION_FRAMES);

/**
 * Question 1 in three stretches, paced by Koko's lines. Eka answers within four seconds of the question
 * opening, faster than it can be said, so:
 * - the question opening and the coin dropping (T = -6.8 to PICK_T) are slowed to last the first line;
 * - picking and locking (PICK_T to SEALED_T) play at real speed as the second line starts;
 * - the rest of the countdown is sped up so the clock reaches zero (T = 12) during the third line.
 */
const PICK_T = -4.8;
const SEALED_T = -1;
const OPEN = say[1].from - 16;
const REAL = OPEN + Math.round((SEALED_T - PICK_T) * FPS);
const ZERO = say[2].from + 55;
const SLOW = ((PICK_T + 6.8) * FPS) / OPEN;
const FAST = ((12 - SEALED_T) * FPS) / (ZERO - REAL);

export const Question: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="3">A question goes live</StepChip>
      <Source />
      <Phone label="Eka's phone" {...PHONE} style={{ left: 60, top: TOP }}>
        <Video
          name="Eka: question opens, slowed"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", -6.8) * fps)}
          durationInFrames={OPEN}
          playbackRate={SLOW}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          name="Eka: pick, lock"
          src={staticFile("footage/eka.mp4")}
          from={OPEN}
          trimBefore={Math.round(at("eka", PICK_T) * fps)}
          durationInFrames={REAL - OPEN}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          name="Eka: sealed, clock runs out"
          src={staticFile("footage/eka.mp4")}
          from={REAL}
          trimBefore={Math.round(at("eka", SEALED_T) * fps)}
          durationInFrames={Math.round((QUESTION_FRAMES - REAL) * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={phoneClip}
        />
      </Phone>
      <Screen kind="projector" label="Big screen in the room" {...BIG} delay={5} style={{ left: 540, top: TOP }}>
        <Video
          name="Big screen: question opens, slowed"
          src={staticFile("footage/big-screen.mp4")}
          trimBefore={Math.round(at("big", -6.8) * fps)}
          durationInFrames={OPEN}
          playbackRate={SLOW}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: answers come in"
          src={staticFile("footage/big-screen.mp4")}
          from={OPEN}
          trimBefore={Math.round(at("big", PICK_T) * fps)}
          durationInFrames={REAL - OPEN}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: clock runs out"
          src={staticFile("footage/big-screen.mp4")}
          from={REAL}
          trimBefore={Math.round(at("big", SEALED_T) * fps)}
          durationInFrames={Math.round((QUESTION_FRAMES - REAL) * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      <Sequence name="Speed tag: slowed" durationInFrames={OPEN} layout="none">
        <Speed style={{ left: 1474, top: TOP - 50 }}>{`×${SLOW.toFixed(1)}`}</Speed>
      </Sequence>
      <Sequence name="Speed tag: sped up" from={REAL} layout="none">
        <Speed style={{ left: 1474, top: TOP - 50 }}>{`×${FAST.toFixed(1)}`}</Speed>
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
