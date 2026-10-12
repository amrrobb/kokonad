import type React from "react";
import { Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Koko } from "../Koko";
import { HOST, TOP } from "../layout";
import { Backdrop, Screen, StepChip } from "../Stage";
import { C } from "../theme";

/** A coral ring drawn around one row of the explorer page, with a plain label beside it. */
const Ring: React.FC<{ readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly children: string }> = ({ x, y, w, h, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x - 10,
        top: y - 8,
        width: w + 20,
        height: h + 16,
        borderRadius: 14,
        border: `5px solid ${C.coral}`,
        boxShadow: "0 0 0 6px rgba(255,107,74,.22)",
        scale: interpolate(frame, [0, 12], [1.25, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
          output: "perceptual-scale",
        }),
        opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      <span
        style={{
          position: "absolute",
          left: w + 34,
          top: "50%",
          translate: "0px -50%",
          whiteSpace: "nowrap",
          padding: "8px 18px",
          borderRadius: 999,
          backgroundColor: C.coral,
          color: "#fff",
          fontWeight: 900,
          fontSize: 30,
        }}
      >
        {children}
      </span>
    </div>
  );
};

/**
 * The payout of question 1 on the block explorer (screenshot taken 12 Oct 2026). Positions are in the
 * screenshot's own 1280x800 space: the picture is shown at exactly that size.
 */
export const Monad: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <StepChip step="7">Every step is a Monad transaction</StepChip>
      <Screen kind="browser" label="Block explorer" url="testnet.monadvision.com/tx/0xce900d25…dc68" {...HOST} style={{ left: 60, top: TOP }}>
        <Img src={staticFile("proof-tx.png")} style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 800 }} />
        <Sequence name="Ring: payout" durationInFrames={Math.round(4.6 * fps)} layout="none">
          <Ring x={282} y={667} w={456} h={32}>
            3 KOKO, room → Eka
          </Ring>
        </Sequence>
        <Sequence name="Ring: block" from={Math.round(4.6 * fps)} durationInFrames={Math.round(4.6 * fps)} layout="none">
          <Ring x={282} y={331} w={244} h={26}>
            a block on Monad testnet
          </Ring>
        </Sequence>
        <Sequence name="Ring: relayer" from={Math.round(9.2 * fps)} layout="none">
          <Ring x={282} y={564} w={432} h={32}>
            sent by the relayer
          </Ring>
        </Sequence>
      </Screen>
      <Koko
        name="Koko: that payout"
        durationInFrames={Math.round(4.6 * fps)}
        premountFor={fps}
        mood="surprised"
        layout="stack"
        size={330}
        bubbleWidth={470}
        fontSize={44}
        enter
        style={{ left: 1392, top: 150, width: 470, height: 860, justifyContent: "flex-end" }}
      >
        That payout? A real transaction on Monad: 3 coins from the room to Eka.
      </Koko>
      <Koko
        name="Koko: 23 transactions"
        from={Math.round(4.6 * fps)}
        durationInFrames={Math.round(4.6 * fps)}
        premountFor={fps}
        mood="happy"
        layout="stack"
        size={330}
        bubbleWidth={470}
        fontSize={44}
        enter={false}
        style={{ left: 1392, top: 150, width: 470, height: 860, justifyContent: "flex-end" }}
      >
        Every seal, reveal and payout is on-chain. This game was 23 transactions.
      </Koko>
      <Koko
        name="Koko: nobody pays gas"
        from={Math.round(9.2 * fps)}
        durationInFrames={Math.round(5.2 * fps)}
        premountFor={fps}
        mood="happy"
        layout="stack"
        size={330}
        bubbleWidth={470}
        fontSize={44}
        enter={false}
        style={{ left: 1392, top: 150, width: 470, height: 860, justifyContent: "flex-end" }}
      >
        Players never pay gas. They sign, a relayer sends, and Monad's fast blocks keep the room in sync.
      </Koko>
    </Backdrop>
  );
};
