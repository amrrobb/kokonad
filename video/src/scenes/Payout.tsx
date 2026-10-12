import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { BIG, bigClip, PHONE, phoneClip, TOP } from "../layout";
import { Backdrop, Phone, Screen, Source, Speed, StepChip } from "../Stage";
import { at } from "../theme";
import { cues, FPS, spoken } from "../voice";

const LINES = ["payout-wait", "payout-land", "payout-standings"] as const;
export const PAYOUT_FRAMES = spoken(LINES) + 28;
const say = cues(LINES, PAYOUT_FRAMES);
/** The dispute window (T = 22 to PAID_T) lasts exactly the first line, whatever speed that takes. */
const WAIT = say[1].from;
const PAID_T = 80.6;
const FAST = ((PAID_T - 22) * FPS) / WAIT;

/**
 * The contract's 60-second dispute window, sped up to last as long as Koko's first line (from T = 22),
 * then the payout at real speed: coins fly into Eka's balance near T = 82. The big screen then cuts to
 * the standings it showed a little later.
 */
export const Payout: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="6">A 60-second dispute window, then the coins land</StepChip>
      <Source />
      <Phone label="Eka's phone" {...PHONE} style={{ left: 60, top: TOP }}>
        <Video
          name="Eka: dispute window, fast"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", 22) * fps)}
          durationInFrames={Math.round(WAIT * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={phoneClip}
        />
        <Video
          name="Eka: coins land"
          src={staticFile("footage/eka.mp4")}
          from={WAIT}
          trimBefore={Math.round(at("eka", PAID_T) * fps)}
          durationInFrames={PAYOUT_FRAMES - WAIT}
          premountFor={fps}
          muted
          style={phoneClip}
        />
      </Phone>
      <Screen kind="projector" label="Big screen in the room" {...BIG} delay={5} style={{ left: 540, top: TOP }}>
        <Video
          name="Big screen: dispute window, fast"
          src={staticFile("footage/big-screen.mp4")}
          trimBefore={Math.round(at("big", 22) * fps)}
          durationInFrames={Math.round(WAIT * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: paid"
          src={staticFile("footage/big-screen.mp4")}
          from={WAIT}
          trimBefore={Math.round(at("big", PAID_T) * fps)}
          durationInFrames={say[2].from - WAIT}
          premountFor={fps}
          muted
          style={bigClip}
        />
        <Video
          name="Big screen: standings"
          src={staticFile("footage/big-screen.mp4")}
          from={say[2].from}
          trimBefore={Math.round(146.6 * fps)}
          durationInFrames={PAYOUT_FRAMES - say[2].from}
          premountFor={fps}
          muted
          style={bigClip}
        />
      </Screen>
      <Sequence name="Speed tag" durationInFrames={WAIT} layout="none">
        <Speed style={{ left: 1502, top: TOP - 50 }}>{`×${Math.round(FAST)}`}</Speed>
      </Sequence>
      <Koko
        name="Koko: dispute window"
        {...say[0]}
        premountFor={fps}
        mood="sleepy"
        layout="row"
        size={250}
        bubbleWidth={980}
        fontSize={44}
        enter
        style={{ left: 560, top: 770 }}
      />
      <Koko
        name="Koko: coins land"
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
        name="Koko: standings"
        {...say[2]}
        premountFor={fps}
        mood="happy"
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
