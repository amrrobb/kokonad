import type React from "react";
import {
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type InteractivitySchema,
} from "remotion";
import { C, fontFamily, type Mood } from "./theme";

type KokoProps = {
  /** What Koko says. */
  readonly children: string;
  readonly mood: Mood;
  /** Mascot size in px. */
  readonly size: number;
  /** "stack": bubble above the mascot. "row": mascot left, bubble right. */
  readonly layout: "stack" | "row";
  readonly bubbleWidth: number;
  readonly fontSize: number;
  /** true on a scene's first line: Koko pops in. Later lines only squash, as if turning to speak. */
  readonly enter: boolean;
  readonly style?: React.CSSProperties;
};

const CHARS_PER_SECOND = 42;

/**
 * Koko, the guide. One instance per spoken line: the pose is one of the four drawn ones, the line is typed
 * into a speech bubble, and Koko bobs while idle and wobbles while the line is being typed.
 */
const KokoInner: React.FC<KokoProps> = ({ children, mood, size, layout, bubbleWidth, fontSize, enter, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = String(children);
  const shown = Math.max(0, Math.min(text.length, Math.floor(((frame - 6) * CHARS_PER_SECOND) / fps)));
  const talking = shown > 0 && shown < text.length;
  const bob = Math.sin((frame / fps) * Math.PI * 1.3) * 6;
  const wobble = talking ? Math.sin(frame * 0.85) : 0;

  const mascot = (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: "relative",
        scale: interpolate(frame, [0, 14], [enter ? 0.4 : 0.9, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(2)),
          output: "perceptual-scale",
        }),
        opacity: interpolate(frame, [0, 5], [enter ? 0 : 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "7%",
          borderRadius: "50%",
          backgroundColor: C.peach,
        }}
      />
      <Img
        src={staticFile(`mascot/mascot-${mood}.png`)}
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          transformOrigin: "50% 90%",
          translate: `0px ${bob}px`,
          rotate: `${wobble * 2.2}deg`,
          scale: `${1 + wobble * 0.012} ${1 - wobble * 0.02}`,
        }}
      />
    </div>
  );

  const bubble = (
    <div
      style={{
        position: "relative",
        width: bubbleWidth,
        boxSizing: "border-box",
        padding: `${Math.round(fontSize * 0.62)}px ${Math.round(fontSize * 0.8)}px`,
        backgroundColor: C.surface,
        border: `3px solid ${C.ink}`,
        borderRadius: Math.round(fontSize * 0.8),
        boxShadow: `0 8px 0 ${C.ink}`,
        color: C.ink,
        fontFamily,
        fontWeight: 800,
        fontSize,
        lineHeight: 1.22,
        letterSpacing: "-0.01em",
        transformOrigin: layout === "stack" ? "70% 100%" : "0% 60%",
        // A scene's first bubble pops in after Koko; later ones are already there and only give a little.
        scale: interpolate(frame, enter ? [2, 13] : [0, 9], [enter ? 0.7 : 0.95, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(1.6)),
          output: "perceptual-scale",
        }),
        opacity: interpolate(frame, [2, 8], [enter ? 0 : 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      {/* The whole line is laid out from frame 0, so the bubble never changes size while it is typed. */}
      <span>{text.slice(0, shown)}</span>
      <span style={{ opacity: 0 }}>{text.slice(shown)}</span>
      <div
        style={{
          position: "absolute",
          width: 30,
          height: 30,
          backgroundColor: C.surface,
          borderRight: `3px solid ${C.ink}`,
          borderBottom: `3px solid ${C.ink}`,
          ...(layout === "stack"
            ? { right: Math.round(size * 0.42), bottom: -19, rotate: "45deg", boxShadow: `6px 6px 0 ${C.ink}` }
            : { left: -19, top: "50%", marginTop: -15, rotate: "135deg" }),
        }}
      />
    </div>
  );

  return (
    <Interactive.Div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: layout === "stack" ? "column" : "row",
        alignItems: layout === "stack" ? "flex-end" : "center",
        gap: layout === "stack" ? 34 : 40,
        ...style,
      }}
    >
      {layout === "stack" ? bubble : mascot}
      {layout === "stack" ? mascot : bubble}
    </Interactive.Div>
  );
};

const kokoSchema = {
  children: { type: "text-content", default: "", description: "What Koko says" },
  size: { type: "number", default: 320, min: 120, max: 700, step: 10, description: "Mascot size", hiddenFromList: false },
  bubbleWidth: { type: "number", default: 480, min: 240, max: 1400, step: 10, description: "Bubble width", hiddenFromList: false },
  fontSize: { type: "number", default: 44, min: 28, max: 90, step: 1, description: "Text size", hiddenFromList: false },
} as const satisfies InteractivitySchema;

export const Koko = Interactive.withSchema({
  Component: KokoInner,
  componentName: "<Koko>",
  schema: kokoSchema,
  wrapInSequence: true,
});
