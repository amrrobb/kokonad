"""
Koko's voice. Reads src/lines.json, speaks every line with edge-tts (Microsoft's read-aloud voices, no key),
trims the silence around it, and writes public/voice/<id>.mp3 plus src/voice.json (seconds per line), which
the scenes use to time themselves.

    .venv-voice/bin/python scripts/voice.py                 # every line whose text changed
    .venv-voice/bin/python scripts/voice.py --all           # every line
    VOICE=en-US-EmmaNeural .venv-voice/bin/python scripts/voice.py --all --out /tmp/try   # audition, nothing in the repo changes

A line may carry "say": the spelling the voice reads when it differs from what the bubble shows.
"""
import asyncio, hashlib, json, os, subprocess, sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
VOICE = os.environ.get("VOICE", "en-US-EmmaNeural")
RATE = os.environ.get("RATE", "+0%")
PITCH = os.environ.get("PITCH", "+0Hz")

args = sys.argv[1:]
audition = Path(args[args.index("--out") + 1]) if "--out" in args else None
out_dir = audition or ROOT / "public" / "voice"
manifest_path = (audition / "voice.json") if audition else ROOT / "src" / "voice.json"
out_dir.mkdir(parents=True, exist_ok=True)

lines = json.loads((ROOT / "src" / "lines.json").read_text())
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}


def seconds(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(out.strip())


async def speak(line_id: str, spoken: str) -> float:
    raw = out_dir / f"{line_id}.raw.mp3"
    final = out_dir / f"{line_id}.mp3"
    await edge_tts.Communicate(spoken, VOICE, rate=RATE, pitch=PITCH).save(str(raw))
    # Silence off both ends (the second pass runs on the reversed clip), then one loudness for every line.
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af",
         f"{trim},areverse,{trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000",
         "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(final)],
        check=True,
    )
    raw.unlink()
    return seconds(final)


async def main() -> None:
    for line_id, line in lines.items():
        spoken = line.get("say", line["text"])
        key = hashlib.sha256(f"{VOICE}|{RATE}|{PITCH}|{spoken}".encode()).hexdigest()[:16]
        have = manifest.get(line_id, {})
        if "--all" not in args and have.get("key") == key and (out_dir / f"{line_id}.mp3").exists():
            continue
        manifest[line_id] = {"seconds": round(await speak(line_id, spoken), 3), "key": key}
        print(f"{line_id:18} {manifest[line_id]['seconds']:6.2f} s  {len(spoken):3} chars")
    for gone in [k for k in manifest if k not in lines]:
        del manifest[gone]
        (out_dir / f"{gone}.mp3").unlink(missing_ok=True)
    ordered = {k: manifest[k] for k in lines}
    manifest_path.write_text(json.dumps(ordered, indent=2) + "\n")
    print(f"total {sum(v['seconds'] for v in ordered.values()):.1f} s of speech, voice {VOICE}")


asyncio.run(main())
