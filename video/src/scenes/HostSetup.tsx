import { Video } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { HOST, hostClip, TOP } from "../layout";
import { Backdrop, Screen, Source, Speed, StepChip } from "../Stage";
import { cues, FPS, spoken } from "../voice";

const LINES = ["host-fund", "host-seal"] as const;
export const HOST_SETUP_FRAMES = spoken(LINES) + 12;
const say = cues(LINES, HOST_SETUP_FRAMES);
/**
 * The recording from "Start a room" (11.8 s) to the question form being filled in (19.9 s) lasts exactly the
 * first line, whatever speed that takes. The rest plays at real speed under the second line: the host
 * presses "Seal" near 21.6 s, as Koko gets to "they are sealed".
 */
const FROM = 11.8;
const SEAL = 19.9;
const WRITE = say[1].from;
const FAST = ((SEAL - FROM) * FPS) / WRITE;

export const HostSetup: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="1">The host opens a room</StepChip>
      <Source />
      <Screen kind="browser" label="Host's laptop" url="kokonad.robbyn.xyz/host" {...HOST} style={{ left: 60, top: TOP }}>
        <Video
          name="Host: create room, write questions, fast"
          src={staticFile("footage/host.mp4")}
          trimBefore={Math.round(FROM * fps)}
          durationInFrames={Math.round(WRITE * FAST)}
          playbackRate={FAST}
          premountFor={fps}
          muted
          style={hostClip}
        />
        <Video
          name="Host: seal the questions"
          src={staticFile("footage/host.mp4")}
          from={WRITE}
          trimBefore={Math.round(SEAL * fps)}
          durationInFrames={HOST_SETUP_FRAMES - WRITE}
          premountFor={fps}
          muted
          style={hostClip}
        />
      </Screen>
      <Sequence name="Speed tag" durationInFrames={WRITE} layout="none">
        <Speed style={{ left: 1262, top: TOP - 50 }}>{`×${FAST.toFixed(1)}`}</Speed>
      </Sequence>
      <Koko
        name="Koko: fund the room"
        {...say[0]}
        premountFor={fps}
        mood="happy"
        layout="stack"
        size={330}
        bubbleWidth={470}
        fontSize={44}
        enter
        style={{
          left: 1392,
          top: 150,
          width: 470,
          height: 860,
          justifyContent: "flex-end",
        }}
      />
      <Koko
        name="Koko: sealed questions"
        {...say[1]}
        premountFor={fps}
        mood="surprised"
        layout="stack"
        size={330}
        bubbleWidth={470}
        fontSize={44}
        enter={false}
        style={{
          left: 1392,
          top: 150,
          width: 470,
          height: 860,
          justifyContent: "flex-end",
        }}
      />
    </Backdrop>
  );
};
