import { Video } from "@remotion/media";
import type React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Phone, Source } from "../Stage";
import { at, C } from "../theme";

export const COLD_OPEN_FRAMES = 90;
/** Eka's phone from just before the payout: the coins fly at about 0.3 s and the balance reads 22 by about 1.1 s. */
const FROM_T = 82.3;
const FLY = 8;
const PAID = 34;
/** The fade into the intro takes the last 12 frames. */
const OUT = COLD_OPEN_FRAMES - 14;
/** The 360x780 recording at 1.6x; the phone runs off the bottom of the frame, since only its top half moves. */
const WIDTH = 576;
const HEIGHT = 1248;

/**
 * Three seconds before anyone explains anything: the end of the game. The pot arrives on the winner's
 * phone, at real speed, with no voice over it.
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <Source />
      <Phone label="Eka's phone" width={WIDTH} height={HEIGHT} delay={-20} style={{ left: 150, top: 150 }}>
        <Video
          name="Eka: the pot arrives"
          src={staticFile("footage/eka.mp4")}
          trimBefore={Math.round(at("eka", FROM_T) * fps)}
          muted
          style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}
        />
      </Phone>
      <div
        style={{
          position: "absolute",
          left: 850,
          top: 330,
          width: 960,
          // Gone before the fade into the intro starts, so Koko's bubble never types over it.
          opacity: interpolate(frame, [OUT - 10, OUT], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 104,
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            opacity: interpolate(frame, [FLY, FLY + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [FLY, FLY + 12], ["0px 24px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }),
          }}
        >
          The pot just paid
          <br />
          the winner.
        </div>
        <div
          style={{
            marginTop: 34,
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontWeight: 800,
            fontSize: 46,
            lineHeight: 1.25,
            color: C.ink2,
            opacity: interpolate(frame, [PAID, PAID + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [PAID, PAID + 14], ["0px 24px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }),
          }}
        >
          <span>By a contract, on</span>
          <Img src={staticFile("brand/monad-logo.svg")} style={{ height: 40, width: 210 }} />
        </div>
      </div>
    </Backdrop>
  );
};
