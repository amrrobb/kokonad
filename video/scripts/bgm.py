"""
The music bed: a light marimba loop, written here note by note so the track is the project's own (no
licence to track). Writes public/music/bgm.mp3, three minutes long; the video uses as much as it needs.

    python3 scripts/bgm.py          # needs numpy and ffmpeg

To use a real track instead, replace public/music/bgm.mp3 and note its source and licence in README.md.
"""
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
BPM = 104
BEAT = 60 / BPM
BARS = 76  # about 175 s
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)

length = int((BARS * 4 * BEAT + 3) * SR)
left = np.zeros(length)
right = np.zeros(length)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def put(sound: np.ndarray, at: float, gain: float, pan: float = 0.0) -> None:
    start = int(at * SR)
    end = min(length, start + len(sound))
    left[start:end] += sound[: end - start] * gain * (1 - max(0.0, pan))
    right[start:end] += sound[: end - start] * gain * (1 + min(0.0, pan))


def marimba(midi: float, seconds: float = 0.9) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    f = hz(midi)
    body = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5)
    knock = np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 28) * 0.28
    return (body + knock) * np.minimum(1, t / 0.004)


def bass(midi: float, seconds: float) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    f = hz(midi)
    tone = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return tone * np.exp(-t * 2.2) * np.minimum(1, t / 0.01)


def kick() -> np.ndarray:
    t = np.arange(int(0.22 * SR)) / SR
    return np.sin(2 * np.pi * (48 * t + 42 * (1 - np.exp(-t * 28)) / 28)) * np.exp(-t * 16)


def shaker() -> np.ndarray:
    n = int(0.07 * SR)
    noise = np.diff(rng.standard_normal(n + 1))  # a crude high-pass
    return noise * np.exp(-np.arange(n) / SR * 55)


# C  Am  F  G  |  C  Em  F  G: chord tones for the arpeggio, the root for the bass.
CHORDS = [
    (36, [60, 64, 67, 72]), (33, [57, 60, 64, 69]), (29, [57, 60, 65, 69]), (31, [59, 62, 67, 71]),
    (36, [60, 64, 67, 72]), (28, [59, 64, 67, 71]), (29, [57, 60, 65, 69]), (31, [59, 62, 67, 74]),
]
ARP = [0, 2, 1, 2, 3, 2, 1, 2]
# A small tune in C pentatonic, one note per beat (None rests), eight bars long.
TUNE = [76, None, 79, 76, 74, None, 72, None, 76, None, 79, 81, 79, None, None, None,
        81, None, 79, 76, 74, None, 76, None, 74, None, 72, 69, 72, None, None, None]

for bar in range(BARS):
    root, tones = CHORDS[bar % 8]
    t0 = bar * 4 * BEAT
    section = bar // 8
    for step, which in enumerate(ARP):
        accent = 1.0 if step % 2 == 0 else 0.72
        put(marimba(tones[which]), t0 + step * BEAT / 2, 0.20 * accent, pan=0.35 if step % 2 else -0.35)
    if bar >= 4:
        put(bass(root + 12, BEAT * 1.9), t0, 0.26)
        put(bass(root + 12, BEAT * 1.9), t0 + 2 * BEAT, 0.20)
    if bar >= 8:
        for beat in (0, 2):
            put(kick(), t0 + beat * BEAT, 0.30)
        for step in range(8):
            if step % 2:
                put(shaker(), t0 + step * BEAT / 2, 0.035, pan=0.2)
    if section % 2 == 1:
        for beat in range(4):
            note = TUNE[(bar % 8) * 4 + beat]
            if note is not None:
                put(marimba(note, 1.2), t0 + beat * BEAT, 0.13, pan=-0.1)

mix = np.stack([left, right], axis=1)
mix = np.tanh(mix * 1.1) / np.max(np.abs(mix)) * 0.8
out = ROOT / "public" / "music"
out.mkdir(parents=True, exist_ok=True)
wav = out / "bgm.raw.s16"
(mix * 32767).astype("<i2").tofile(wav)
subprocess.run(
    ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", str(wav),
     "-af", "loudnorm=I=-18:TP=-2:LRA=9,aresample=48000", "-c:a", "libmp3lame", "-b:a", "128k", str(out / "bgm.mp3")],
    check=True,
)
wav.unlink()
print("wrote", out / "bgm.mp3")
