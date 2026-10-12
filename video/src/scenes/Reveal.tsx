import { Video } from "@remotion/media";
import type React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, StepChip } from "../Stage";
import { at } from "../theme";

/** T = 13 to 22: phones open their answers, the host picks the result. Host window at 0.8x, two phones at 0.95x. */
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
          durationInFrames={Math.round(9 * fps)}
          premountFor={fps}
          muted
          style={{ position: "absolute", left: 0, top: 0, width: 1024, height: 640 }}
        />
      </Screen>
      <Phone label="Eka" width={342} height={741} delay={4} style={{ left: 1130, top: TOP }}>
        <Video
          name="Eka: answer opens"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", 13) * fps)}
          durationInFrames={Math.round(9 * fps)}
          premountFor={fps}
          muted
          style={{ position: "absolute", left: 0, top: 0, width: 342, height: 741 }}
        />
      </Phone>
      <Phone label="Gita: no answer" width={342} height={741} delay={8} style={{ left: 1512, top: TOP }}>
        <Video
          name="Gita: sat out"
          src={staticFile("footage/gita.mp4")}
          trimBefore={Math.round(at("gita", 13) * fps)}
          durationInFrames={Math.round(9 * fps)}
          premountFor={fps}
          muted
          style={{ position: "absolute", left: 0, top: 0, width: 342, height: 741 }}
        />
      </Phone>
      <Koko
        name="Koko: answers open"
        durationInFrames={Math.round(4.2 * fps)}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={210}
        bubbleWidth={780}
        fontSize={42}
        enter
        style={{ left: 70, top: 828 }}
      >
        Time's up. Every phone opens its sealed answer on its own.
      </Koko>
      <Koko
        name="Koko: host sets the result"
        from={Math.round(4.2 * fps)}
        durationInFrames={Math.round(4.8 * fps)}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={210}
        bubbleWidth={780}
        fontSize={42}
        enter={false}
        style={{ left: 70, top: 828 }}
      >
        The host sets what really happened. That is the one thing a person decides.
      </Koko>
    </Backdrop>
  );
};
