import { Video } from "@remotion/media";
import type React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, StepChip } from "../Stage";
import { at } from "../theme";
import { cues, spoken } from "../voice";

const LINES = ["reveal-open", "reveal-host"] as const;
export const REVEAL_FRAMES = spoken(LINES) + 12;
const say = cues(LINES, REVEAL_FRAMES);

/** From T = 13, at real speed: phones open their answers, then the host picks the result (near T = 19). */
export const Reveal: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="4">Answers open, the host sets the result</StepChip>
      <Source />
      <Screen kind="browser" label="Host's laptop" url="kokonad.robbyn.xyz/host/RN2U3C" width={1024} height={640} style={{ left: 60, top: TOP }}>
        <Video
          name="Host: which answer was right"
          src={staticFile("footage/host.mp4")}
          trimBefore={Math.round(at("host", 13) * fps)}
          durationInFrames={REVEAL_FRAMES}
          premountFor={fps}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1024,
            height: 640,
          }}
        />
      </Screen>
      <Phone label="Eka" width={342} height={741} delay={4} style={{ left: 1130, top: TOP }}>
        <Video
          name="Eka: answer opens"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", 13) * fps)}
          durationInFrames={REVEAL_FRAMES}
          premountFor={fps}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 342,
            height: 741,
          }}
        />
      </Phone>
      <Phone label="Gita: no answer" width={342} height={741} delay={8} style={{ left: 1512, top: TOP }}>
        <Video
          name="Gita: sat out"
          src={staticFile("footage/gita.mp4")}
          trimBefore={Math.round(at("gita", 13) * fps)}
          durationInFrames={REVEAL_FRAMES}
          premountFor={fps}
          muted
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 342,
            height: 741,
          }}
        />
      </Phone>
      <Koko
        name="Koko: answers open"
        {...say[0]}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={210}
        bubbleWidth={780}
        fontSize={42}
        enter
        style={{ left: 70, top: 828 }}
      />
      <Koko
        name="Koko: host sets the result"
        {...say[1]}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={210}
        bubbleWidth={780}
        fontSize={42}
        enter={false}
        style={{ left: 70, top: 828 }}
      />
    </Backdrop>
  );
};
