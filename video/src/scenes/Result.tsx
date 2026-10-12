import { Video } from "@remotion/media";
import type React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { TOP } from "../layout";
import { Backdrop, Phone, Source, StepChip } from "../Stage";
import { at } from "../theme";

/** T = 19.6 to 29.6: the same ten seconds on all three phones, at their recorded size. */
export const Result: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="5">The pot is split</StepChip>
      <Source />
      <Phone label="Eka: right" width={360} height={780} style={{ left: 60, top: TOP }}>
        <Video
          name="Eka: +3"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", 19.6) * fps)}
          durationInFrames={Math.round(10 * fps)}
          premountFor={fps}
          muted
          style={{ position: "absolute", left: 0, top: 0, width: 360, height: 780 }}
        />
      </Phone>
      <Phone label="Fajar: wrong" width={429} height={780} delay={5} style={{ left: 480, top: TOP }}>
        <Video
          name="Fajar: -1"
          src={staticFile("footage/fajar.mp4")}
          trimBefore={Math.round(at("fajar", 19.6) * fps)}
          durationInFrames={Math.round(10 * fps)}
          premountFor={fps}
          muted
          style={{ position: "absolute", left: -409, top: 0, width: 1248, height: 780 }}
        />
      </Phone>
      <Phone label="Gita: sat out" width={360} height={780} delay={10} style={{ left: 969, top: TOP }}>
        <Video
          name="Gita: -1"
          src={staticFile("footage/gita.mp4")}
          trimBefore={Math.round(at("gita", 19.6) * fps)}
          durationInFrames={Math.round(10 * fps)}
          premountFor={fps}
          muted
          style={{ position: "absolute", left: 0, top: 0, width: 360, height: 780 }}
        />
      </Phone>
      <Koko
        name="Koko: winner takes the pot"
        durationInFrames={Math.round(5.2 * fps)}
        premountFor={fps}
        mood="happy"
        layout="stack"
        size={330}
        bubbleWidth={460}
        fontSize={44}
        enter
        style={{ left: 1400, top: 150, width: 460, height: 860, justifyContent: "flex-end" }}
      >
        The contract splits the pot between everyone who was right. Eka takes all 3 coins.
      </Koko>
      <Koko
        name="Koko: wrong or sat out"
        from={Math.round(5.2 * fps)}
        durationInFrames={Math.round(4.8 * fps)}
        premountFor={fps}
        mood="oops"
        layout="stack"
        size={330}
        bubbleWidth={460}
        fontSize={44}
        enter={false}
        style={{ left: 1400, top: 150, width: 460, height: 860, justifyContent: "flex-end" }}
      >
        Wrong, or sat it out? Your coin stays in the pot.
      </Koko>
    </Backdrop>
  );
};
