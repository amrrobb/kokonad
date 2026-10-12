import { Video } from "@remotion/media";
import type React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { TOP } from "../layout";
import { Backdrop, Phone, Source, StepChip } from "../Stage";
import { at } from "../theme";
import { cues, spoken } from "../voice";

const LINES = ["result-split", "result-lost"] as const;
export const RESULT_FRAMES = spoken(LINES) + 12;
const say = cues(LINES, RESULT_FRAMES);

/** From T = 19.6, at real speed: the same seconds on all three phones. */
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
          durationInFrames={RESULT_FRAMES}
          premountFor={fps}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 360,
            height: 780,
          }}
        />
      </Phone>
      <Phone label="Fajar: wrong" width={429} height={780} delay={5} style={{ left: 480, top: TOP }}>
        <Video
          name="Fajar: -1"
          src={staticFile("footage/fajar.mp4")}
          trimBefore={Math.round(at("fajar", 19.6) * fps)}
          durationInFrames={RESULT_FRAMES}
          premountFor={fps}
          muted
          style={{
            position: "absolute",
            left: -409,
            top: 0,
            width: 1248,
            height: 780,
          }}
        />
      </Phone>
      <Phone label="Gita: sat out" width={360} height={780} delay={10} style={{ left: 969, top: TOP }}>
        <Video
          name="Gita: -1"
          src={staticFile("footage/gita.mp4")}
          trimBefore={Math.round(at("gita", 19.6) * fps)}
          durationInFrames={RESULT_FRAMES}
          premountFor={fps}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 360,
            height: 780,
          }}
        />
      </Phone>
      <Koko
        name="Koko: winner takes the pot"
        {...say[0]}
        premountFor={fps}
        mood="happy"
        layout="stack"
        size={330}
        bubbleWidth={460}
        fontSize={44}
        enter
        style={{
          left: 1400,
          top: 150,
          width: 460,
          height: 860,
          justifyContent: "flex-end",
        }}
      />
      <Koko
        name="Koko: wrong or sat out"
        {...say[1]}
        premountFor={fps}
        mood="oops"
        layout="stack"
        size={330}
        bubbleWidth={460}
        fontSize={44}
        enter={false}
        style={{
          left: 1400,
          top: 150,
          width: 460,
          height: 860,
          justifyContent: "flex-end",
        }}
      />
    </Backdrop>
  );
};
