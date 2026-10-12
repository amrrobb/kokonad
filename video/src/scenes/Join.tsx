import { Video } from "@remotion/media";
import type React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, Speed, StepChip } from "../Stage";
import { SYNC } from "../theme";

export const Join: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="2">Players join with a code</StepChip>
      <Source />
      <Phone label="Eka's phone" {...PHONE} style={{ left: 60, top: TOP }}>
        <Video
          name="Eka: name, join, lobby"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round((12 - SYNC.big + SYNC.eka) * fps)}
          durationInFrames={Math.round(22 * fps)}
          playbackRate={2}
          premountFor={fps}
          muted
          style={phoneClip}
        />
      </Phone>
      <Screen kind="projector" label="Big screen in the room" {...BIG} delay={5} style={{ left: 540, top: TOP }}>
        <Video
          name="Big screen: code, people arriving"
          src={staticFile("footage/big-screen.mp4")}
          trimBefore={Math.round(12 * fps)}
          durationInFrames={Math.round(22 * fps)}
          playbackRate={2}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      <Speed style={{ left: 1516, top: TOP - 50 }}>×2</Speed>
      <Koko
        name="Koko: scan the code"
        durationInFrames={Math.round(5 * fps)}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter
        style={{ left: 560, top: 770 }}
      >
        Players scan the code on the big screen. Nothing to install.
      </Koko>
      <Koko
        name="Koko: no wallet, no gas"
        from={Math.round(5 * fps)}
        durationInFrames={Math.round(6 * fps)}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      >
        No wallet, no gas. Type a name, and your coins from the host are already waiting.
      </Koko>
    </Backdrop>
  );
};
