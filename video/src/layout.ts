import type React from "react";

/** Where frames sit on the 1920x1080 canvas. A label sits 44px above each frame. */
export const TOP = 128;

/** A 360x780 phone recording shown at 1.1x. */
export const PHONE = { width: 396, height: 858 } as const;
export const phoneClip: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: 396, height: 858 };

/** Fajar played in a 1280x800 window; the participant screen is the 440px column in its middle. */
export const WIDE_PHONE = { width: 472, height: 858 } as const;
export const widePhoneClip: React.CSSProperties = { position: "absolute", left: -450, top: 0, width: 1373, height: 858 };

/** The host's 1280x800 window at its recorded size. */
export const HOST = { width: 1280, height: 800 } as const;
export const hostClip: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: 1280, height: 800 };

/** The 1280x720 big screen at 0.8125x, beside a phone. */
export const BIG = { width: 1040, height: 585 } as const;
export const bigClip: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: 1040, height: 585 };
