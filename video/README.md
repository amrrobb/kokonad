# Kokonad videos

The demo video and the pitch video for the submission. The demo is built with [Remotion](https://www.remotion.dev): real recordings of one game
on the public site, with Koko (the mascot) walking through it scene by scene.

```sh
npm install
npm run dev                     # Remotion Studio: preview, edit layout and timings, render
npx remotion render KokonadDemo out/kokonad-demo.mp4
npx remotion render KokonadPitch out/kokonad-pitch.mp4
```

## What is in it

`KokonadDemo` (1920x1080, 30 fps, about 112 s, with Koko's voice and a music bed) is eleven scenes joined by short fades in `src/Demo.tsx`. Each scene is its
own file in `src/scenes/` and is also registered on its own (folder "Scenes" in Studio), so it can be opened
and edited alone.

| Scene | Shows |
|---|---|
| ColdOpen | Three seconds with no voice: the pot arrives on the winner's phone, at real speed |
| Intro | Koko says what Kokonad is |
| 1 HostSetup | host's laptop: create a room, seal the questions |
| 2 Join | a phone joining, the big screen filling up |
| 3 Question | phone and big screen while question 1 is live |
| 4 Reveal | host sets the result; two phones |
| 5 Result | three phones: right, wrong, sat out |
| 5b Split | drawn, not recorded, and labelled so on screen: six players, three right, two coins each, as `Room._settle` divides it. The recorded game had one winner, so no pot is shared in the footage |
| 6 Payout | the contract's 60 s dispute window sped up, coins landing, standings |
| 7 Monad | the payout transaction on the block explorer |
| Outro | where to try it |

The pose is the `mood` prop (`happy`, `surprised`, `oops`, `sleepy`), one of the four drawn poses in
`public/mascot/`.

## The pitch video

`KokonadPitch` (`src/pitch/Pitch.tsx`, about 78 s, capped at two minutes in `Root.tsx`) is five parts timed by their lines, like the
demo: who built it, the problem, what Kokonad does (two clips of the recorded game), why Monad (figures from that game, labelled
as played by test browsers), and who it is for and where it stands. Its lines are the `pitch-` entries in `src/lines.json`.

## Koko's lines and voice

Every line is an entry in `src/lines.json`, and a `<Koko line="...">` shows and speaks it. The voice is generated,
not recorded:

```sh
python3 -m venv .venv-voice && .venv-voice/bin/pip install edge-tts    # once
.venv-voice/bin/python scripts/voice.py                                # after changing any line
```

The script speaks each changed line with [edge-tts](https://github.com/rany2/edge-tts) (voice `en-US-EmmaNeural`;
`VOICE=...` picks another, `--out <dir>` auditions one without touching the repo), trims the silence, and writes
`public/voice/<id>.mp3` and the line's length to `src/voice.json`. Scenes are timed from those lengths
(`src/voice.ts`): a scene lasts as long as its lines take to say, and the text is typed at the pace of the voice.
So the order is always: edit `lines.json`, run the script, then look at the scene. A line may carry `"say"`, the
spelling the voice reads when it differs from the bubble ("Ekka" for Eka, which it otherwise spells out).

edge-tts uses the read-aloud voices of Microsoft Edge through an endpoint that is not a documented public API. It
needs no key, which is why it is here; a recorded voice or a licensed one can replace the files in
`public/voice/` as long as `voice.json` gets the new lengths.

## Music

`public/music/bgm.mp3` is written note by note by `scripts/bgm.py` (a marimba loop; needs numpy), so it has no
licence to keep track of. `src/Demo.tsx` plays it well under the voice and brings it up after the last line. To
use a real track, replace the file and write its source and licence here.

## The footage

Everything on screen is one real game: room `RN2U3C` on https://kokonad.robbyn.xyz, Monad testnet, played on
12 Oct 2026 by the end-to-end suite (`E2E_TARGET=public E2E_VIDEO=1 pnpm e2e game.spec.ts` in `web/`), which
records every tab. The room is `0x0Ab4d3ceb6694f221540978712DC4618FcE2a094`; the payout shown in scene 7 is
transaction `0xce900d25deeca7eb0ee12967981ac994f468a947c2600017abd4d057dbd3dc68`.

The recordings are not in git (about 70 MB). Put the five `.webm` files in `footage-raw/` as `host`,
`big-screen`, `Eka`, `Fajar`, `Gita` and run `sh scripts/footage.sh`.

The five tabs started at different moments. `SYNC` in `src/theme.ts` is the second in each clip at which
question 1's countdown showed 12; clips are trimmed with `at(clip, T)` so that side-by-side screens show the
same instant. Speeds other than 1x carry a tag on screen (`×2`, `×11`).

## Rendering on this machine

`remotion.config.ts` picks Chrome for Testing and one render tab at a time. With the default headless shell every
render stopped at "Waiting for root component to load", and with several tabs some frames came out garbled.

## Monad's logo

`public/brand/monad-logo.svg` and `monad-mark.svg` are Monad's own logo, taken from monad.xyz/brand-and-media-kit on 13 Oct 2026 and used as
published (the wordmark's page-dependent colour is fixed to the kit's dark navy). They are Monad's trademark, not part of this repo's licence.
