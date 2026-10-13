import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, fontFamily } from "./theme";

/** The app's warm page: cream with two peach corners. */
export const Backdrop: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      fontFamily,
      color: C.ink,
      background: `radial-gradient(1150px 620px at 97% 0%, #fbe0cf, transparent 66%), radial-gradient(960px 520px at 0% 100%, #fbe0cf, transparent 66%), ${C.bg}`,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Top-left label: which step of the game this scene is. */
export const StepChip: React.FC<{ readonly step: string; readonly children: string }> = ({ step, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 26,
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontWeight: 900,
        fontSize: 30,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        translate: interpolate(frame, [0, 12], ["-24px 0px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        }),
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: C.coral,
          color: "#fff",
        }}
      >
        {step}
      </span>
      <span>{children}</span>
    </div>
  );
};

/** Top-right fine print: where the footage comes from. */
export const Source: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: 60,
      top: 34,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontWeight: 800,
      fontSize: 24,
      color: C.ink3,
    }}
  >
    <span>Recorded on kokonad.robbyn.xyz · room RN2U3C ·</span>
    <Img src={staticFile("brand/monad-mark.svg")} style={{ width: 24, height: 24 }} />
    <span>Monad testnet</span>
  </div>
);

/** "Built on" beside Monad's own logo, which is used as published: not redrawn, not recoloured. */
export const BuiltOnMonad: React.FC<{ readonly height: number; readonly style?: React.CSSProperties }> = ({ height, style }) => (
  <div
    style={{ display: "inline-flex", alignItems: "center", gap: height * 0.45, fontWeight: 800, fontSize: height * 0.95, color: C.ink2, ...style }}
  >
    <span>Built on</span>
    <Img src={staticFile("brand/monad-logo.svg")} style={{ height, width: (height * 126) / 24 }} />
  </div>
);

/** A small "×16" tag shown while footage is sped up. */
export const Speed: React.FC<{ readonly children: string; readonly style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      padding: "4px 16px",
      borderRadius: 999,
      backgroundColor: C.ink,
      color: "#fff",
      fontWeight: 900,
      fontSize: 28,
      ...style,
    }}
  >
    {children}
  </div>
);

const rise = (frame: number, delay: number) => ({
  opacity: interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  translate: interpolate(frame, [delay, delay + 16], ["0px 46px", "0px 0px"], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  }),
});

const Label: React.FC<{ readonly children: string }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: -44,
      fontWeight: 900,
      fontSize: 26,
      color: C.ink2,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/** A phone: the recording is shown at `width` x `height`, inside a dark bezel. Children are the clips. */
export const Phone: React.FC<{
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly delay?: number;
  readonly style?: React.CSSProperties;
  readonly children: React.ReactNode;
}> = ({ label, width, height, delay = 0, style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", ...rise(frame, delay), ...style }}>
      <Label>{label}</Label>
      <div
        style={{
          width,
          height,
          position: "relative",
          overflow: "hidden",
          borderRadius: 40,
          border: `10px solid ${C.ink}`,
          boxShadow: "0 24px 50px rgba(59,31,20,.20)",
          backgroundColor: C.bg,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** A laptop browser window (the host) or a projector screen (the big screen). Children are the clips. */
export const Screen: React.FC<{
  readonly kind: "browser" | "projector";
  readonly label: string;
  readonly url?: string;
  readonly width: number;
  readonly height: number;
  readonly delay?: number;
  readonly style?: React.CSSProperties;
  readonly children: React.ReactNode;
}> = ({ kind, label, url, width, height, delay = 0, style, children }) => {
  const frame = useCurrentFrame();
  const bar = kind === "browser" ? 44 : 0;
  return (
    <div style={{ position: "absolute", ...rise(frame, delay), ...style }}>
      <Label>{label}</Label>
      <div
        style={{
          width,
          borderRadius: kind === "browser" ? 20 : 14,
          overflow: "hidden",
          border: `${kind === "browser" ? 3 : 10}px solid ${C.ink}`,
          boxShadow: "0 24px 50px rgba(59,31,20,.20)",
          backgroundColor: C.bg,
        }}
      >
        {kind === "browser" ? (
          <div
            style={{
              height: bar,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 16px",
              backgroundColor: C.bg2,
              borderBottom: `2px solid ${C.line}`,
            }}
          >
            {[C.coral, C.gold, C.green].map((c) => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c }} />
            ))}
            <span
              style={{
                marginLeft: 14,
                padding: "3px 16px",
                borderRadius: 999,
                backgroundColor: C.surface,
                fontWeight: 800,
                fontSize: 18,
                color: C.ink2,
              }}
            >
              {url}
            </span>
          </div>
        ) : null}
        <div style={{ width, height, position: "relative", overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
};
