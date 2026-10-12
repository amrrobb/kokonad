import type React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { Backdrop } from "../Stage";
import { C } from "../theme";
import { cues, spoken } from "../voice";

const LINES = ["intro-hello", "intro-what"] as const;
export const INTRO_FRAMES = spoken(LINES) + 14;
const say = cues(LINES, INTRO_FRAMES);

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 96,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 22,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 16], ["0px -30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          }),
        }}
      >
        <Img src={staticFile("mascot/logo-512.png")} style={{ width: 110, height: 110 }} />
        <span style={{ fontWeight: 900, fontSize: 104, letterSpacing: "-0.03em" }}>Kokonad</span>
      </div>
      <Koko
        name="Koko: hello"
        {...say[0]}
        premountFor={fps}
        mood="happy"
        layout="row"
        size={460}
        bubbleWidth={900}
        fontSize={64}
        enter
        style={{ left: 210, top: 330 }}
      />
      <Koko
        name="Koko: what it is"
        {...say[1]}
        premountFor={fps}
        mood="surprised"
        layout="row"
        size={460}
        bubbleWidth={900}
        fontSize={58}
        enter={false}
        style={{ left: 210, top: 330 }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 84,
          textAlign: "center",
          fontWeight: 800,
          fontSize: 34,
          color: C.ink2,
          opacity: interpolate(frame, [say[1].from + 12, say[1].from + 27], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Everything you are about to see was recorded on kokonad.robbyn.xyz, on Monad testnet.
      </div>
    </Backdrop>
  );
};
