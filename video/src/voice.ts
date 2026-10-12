import lines from "./lines.json";
import voice from "./voice.json";

/**
 * What Koko says lives in lines.json; scripts/voice.py speaks each line into public/voice/<id>.mp3 and
 * writes its length to voice.json. Scenes are timed from those lengths, so after changing a line, run the
 * script again and every scene follows.
 */
export type LineId = keyof typeof lines;

export const FPS = 30;
/** Frames before Koko starts to speak: the pop-in. */
export const LEAD = 6;
/** The breath after a line. */
const GAP = 10;

export const lineText = (id: LineId): string => lines[id].text;
export const voiceFrames = (id: LineId): number => Math.ceil(voice[id].seconds * FPS);

export type Cue = {
  readonly line: LineId;
  readonly from: number;
  readonly durationInFrames: number;
};

/** Lines back to back from frame 0. With `total`, the last line holds until the scene ends. */
export const cues = (ids: readonly LineId[], total?: number): Cue[] => {
  let from = 0;
  return ids.map((line, i) => {
    const slot = LEAD + voiceFrames(line) + GAP;
    const cue = {
      line,
      from,
      durationInFrames: i === ids.length - 1 && total ? total - from : slot,
    };
    from += slot;
    return cue;
  });
};

/** The frame at which the last of these lines has been said, breath included. */
export const spoken = (ids: readonly LineId[]): number => ids.reduce((sum, id) => sum + LEAD + voiceFrames(id) + GAP, 0);
