import type React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { Backdrop } from "../Stage";
import { C } from "../theme";
import { cues, spoken } from "../voice";

const LINES = ["outro-try"] as const;
export const OUTRO_FRAMES = spoken(LINES) + 60;
const say = cues(LINES, OUTRO_FRAMES);

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 250,
          width: 900,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 16], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Img src={staticFile("mascot/logo-512.png")} style={{ width: 120, height: 120 }} />
          <span style={{ fontWeight: 900, fontSize: 120, letterSpacing: "-0.03em" }}>Kokonad</span>
        </div>
        <p
          style={{
            margin: "26px 0 0",
            fontWeight: 800,
            fontSize: 48,
            lineHeight: 1.2,
            color: C.ink2,
          }}
        >
          Live guessing games for community events, settled on Monad.
        </p>
        <div
          style={{
            marginTop: 44,
            display: "inline-block",
            padding: "18px 38px",
            borderRadius: 999,
            backgroundColor: C.coral,
            boxShadow: `0 8px 0 ${C.coralD}`,
            color: "#fff",
            fontWeight: 900,
            fontSize: 56,
          }}
        >
          kokonad.robbyn.xyz
        </div>
        <p
          style={{
            margin: "40px 0 0",
            fontWeight: 800,
            fontSize: 34,
            color: C.ink3,
          }}
        >
          github.com/amrrobb/kokonad · Monad Metropolis, Track 03
        </p>
      </div>
      <Koko
        name="Koko: try it"
        {...say[0]}
        premountFor={fps}
        mood="happy"
        layout="stack"
        size={420}
        bubbleWidth={620}
        fontSize={52}
        enter
        style={{
          left: 1150,
          top: 170,
          width: 650,
          height: 820,
          justifyContent: "flex-end",
        }}
      />
    </Backdrop>
  );
};
