import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, Speed, StepChip } from "../Stage";
import { at } from "../theme";

/**
 * The 60 seconds in which players may disagree, at 16x (T = 22 to 80.67), then the payout at real speed:
 * coins fly into Eka's balance near T = 82. The big screen then cuts to the standings it showed a little later.
 */
export const Payout: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="6">60 seconds to disagree, then the coins land</StepChip>
      <Source />
      <Phone label="Eka's phone" {...PHONE} style={{ left: 60, top: TOP }}>
        <Video
          name="Eka: dispute window (16x)"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", 22) * fps)}
          durationInFrames={1760}
          playbackRate={16}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          name="Eka: coins land"
          src={staticFile("footage/eka.mp4")}
          from={110}
          trimBefore={Math.round(at("eka", 80.67) * fps)}
          durationInFrames={220}
          premountFor={fps}
          muted
          style={phoneClip}
        />
      </Phone>
      <Screen kind="projector" label="Big screen in the room" {...BIG} delay={5} style={{ left: 540, top: TOP }}>
        <Video
          name="Big screen: dispute window (16x)"
          src={staticFile("footage/big-screen.mp4")}
          trimBefore={Math.round(at("big", 22) * fps)}
          durationInFrames={1760}
          playbackRate={16}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: paid"
          src={staticFile("footage/big-screen.mp4")}
          from={110}
          trimBefore={Math.round(at("big", 80.67) * fps)}
          durationInFrames={140}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: standings"
          src={staticFile("footage/big-screen.mp4")}
          from={250}
          trimBefore={Math.round(146.1 * fps)}
          durationInFrames={80}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      <Sequence name="Speed tag" durationInFrames={110} layout="none">
        <Speed style={{ left: 1502, top: TOP - 50 }}>×16</Speed>
      </Sequence>
      <Koko
        name="Koko: time to disagree"
        durationInFrames={110}
        premountFor={fps}
        mood="sleepy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter
        style={{ left: 560, top: 770 }}
      >
        Everyone gets 60 seconds to disagree with the result.
      </Koko>
      <Koko
        name="Koko: coins land"
        from={110}
        durationInFrames={140}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      >
        Nobody did, so the coins land. No one has to claim anything.
      </Koko>
      <Koko
        name="Koko: standings"
        from={250}
        durationInFrames={80}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter={false}
        style={{ left: 560, top: 770 }}
      >
        And the standings update for the whole room.
      </Koko>
    </Backdrop>
  );
};
