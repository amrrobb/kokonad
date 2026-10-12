import { Video } from "@remotion/media";
import type React from "react";
import { staticFile, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { HOST, hostClip, TOP } from "../layout";
import { Backdrop, Screen, Source, Speed, StepChip } from "../Stage";
import { cues, spoken } from "../voice";

const LINES = ["host-fund", "host-draft", "host-seal"] as const;
export const HOST_SETUP_FRAMES = spoken(LINES) + 12;
const say = cues(LINES, HOST_SETUP_FRAMES);

export const HostSetup: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="1">The host opens a room</StepChip>
      <Source />
      <Screen kind="browser" label="Host's laptop" url="kokonad.robbyn.xyz/host" {...HOST} style={{ left: 60, top: TOP }}>
        <Video
          name="Host: create room, seal questions"
          src={staticFile("footage/host.mp4")}
          trimBefore={Math.round(10.5 * fps)}
          durationInFrames={Math.round(HOST_SETUP_FRAMES * 1.3)}
          playbackRate={1.3}
          premountFor={fps}
          muted
          style={hostClip}
        />
      </Screen>
      <Speed style={{ left: 1262, top: TOP - 50 }}>×1.3</Speed>
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
        name="Koko: a first draft"
        {...say[1]}
        premountFor={fps}
        mood="happy"
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
      <Koko
        name="Koko: sealed questions"
        {...say[2]}
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
