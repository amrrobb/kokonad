# Kokonad demo video

The demo video for the submission, built with [Remotion](https://www.remotion.dev): real recordings of one game
on the public site, with Koko (the mascot) walking through it scene by scene.

```sh
npm install
npm run dev                     # Remotion Studio: preview, edit lines and timings, render
npx remotion render KokonadDemo out/kokonad-demo.mp4
```

## What is in it

`KokonadDemo` (1920x1080, 30 fps, 94.2 s) is nine scenes joined by short fades in `src/Demo.tsx`. Each scene is its
own file in `src/scenes/` and is also registered on its own (folder "Scenes" in Studio), so it can be opened
and edited alone.

| Scene | Shows |
|---|---|
| Intro | Koko says what Kokonad is |
| 1 HostSetup | host's laptop: create a room, seal the questions |
| 2 Join | a phone joining, the big screen filling up |
| 3 Question | phone and big screen while question 1 is live |
| 4 Reveal | host sets the result; two phones |
| 5 Result | three phones: right, wrong, sat out |
| 6 Payout | the 60 s dispute window sped up, coins landing, standings |
| 7 Monad | the payout transaction on the block explorer |
| Outro | where to try it |

Koko's lines are the text between `<Koko>` tags: edit them in the scene file or in Studio's inspector. The pose
is the `mood` prop (`happy`, `surprised`, `oops`, `sleepy`), one of the four drawn poses in `public/mascot/`.

## The footage

Everything on screen is one real game: room `RN2U3C` on https://kokonad.robbyn.xyz, Monad testnet, played on
12 Oct 2026 by the end-to-end suite (`E2E_TARGET=public E2E_VIDEO=1 pnpm e2e game.spec.ts` in `web/`), which
records every tab. The room is `0x0Ab4d3ceb6694f221540978712DC4618FcE2a094`; the payout shown in scene 7 is
transaction `0xce900d25deeca7eb0ee12967981ac994f468a947c2600017abd4d057dbd3dc68`.

The recordings are not in git (about 70 MB). Put the five `.webm` files in `footage-raw/` as `host`,
`big-screen`, `Eka`, `Fajar`, `Gita` and run `sh scripts/footage.sh`.

The five tabs started at different moments. `SYNC` in `src/theme.ts` is the second in each clip at which
question 1's countdown showed 12; clips are trimmed with `at(clip, T)` so that side-by-side screens show the
same instant. Speeds other than 1x carry a tag on screen (`×2`, `×13`).

## Rendering on this machine

`remotion.config.ts` picks Chrome for Testing and one render tab at a time. With the default headless shell every
render stopped at "Waiting for root component to load", and with several tabs some frames came out garbled.
