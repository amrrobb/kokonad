import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, Speed, StepChip } from "../Stage";
import { at } from "../theme";

/** Question 1 from the moment it opens (T = -6.8) at real speed, then the rest of the countdown at 2.5x. */
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
          durationInFrames={Math.round(8.5 * fps)}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          name="Eka: sealed, clock runs out"
          src={staticFile("footage/eka.mp4")}
          from={Math.round(8.5 * fps)}
          trimBefore={Math.round(at("eka", 1.7) * fps)}
          durationInFrames={Math.round(13.75 * fps)}
          playbackRate={2.5}
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
          durationInFrames={Math.round(8.5 * fps)}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: clock runs out"
          src={staticFile("footage/big-screen.mp4")}
          from={Math.round(8.5 * fps)}
          trimBefore={Math.round(at("big", 1.7) * fps)}
          durationInFrames={Math.round(13.75 * fps)}
          playbackRate={2.5}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      <Sequence name="Speed tag" from={Math.round(8.5 * fps)} layout="none">
        <Speed style={{ left: 1490, top: TOP - 50 }}>×2.5</Speed>
      </Sequence>
      <Koko
        name="Koko: one coin each"
        durationInFrames={Math.round(4.4 * fps)}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter
        style={{ left: 560, top: 770 }}
      >
        The host opens a question. One coin from every player drops into the pot.
      </Koko>
      <Koko
        name="Koko: sealed answer"
        from={Math.round(4.4 * fps)}
        durationInFrames={Math.round(4.8 * fps)}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      >
        Pick, then lock. Your answer is sealed: nobody can peek or copy it, not even the host.
      </Koko>
      <Koko
        name="Koko: clock runs out"
        from={Math.round(9.2 * fps)}
        durationInFrames={Math.round(4.8 * fps)}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      >
        When the clock runs out, no more answers get in.
      </Koko>
    </Backdrop>
  );
};
