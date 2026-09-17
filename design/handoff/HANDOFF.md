# Kokonad — design hand-off (17 Sep 2026)

Approved in Claude Design: landing (direction 1B), mascot poses, share-recap templates. Everything follows `docs/DESIGN.md`; no new colors, fonts, or animations.

## Note for Claude Code
Place landing at `web/app/(marketing)/page.tsx` using the existing tokens; assets go to `web/public/mascot/` and `web/public/recap/`. Do not touch participant or host screens; they're built from `docs/screens.html`.

## Files
| Path | What | Where it goes |
|---|---|---|
| `landing.html` | Self-contained landing page (1B), responsive 360–1440. Inline styles, Nunito from Google Fonts, all images embedded. Rebuild as `page.tsx`; keep copy and layout as-is | `web/app/(marketing)/page.tsx` |
| `mascot/mascot-surprised.png` | Baseline pose, 1024², transparent | `web/public/mascot/` |
| `mascot/mascot-happy.png` | Win / result pose | `web/public/mascot/` |
| `mascot/mascot-oops.png` | Lose pose | `web/public/mascot/` |
| `mascot/mascot-sleepy.png` | Sat out / waiting-for-host pose | `web/public/mascot/` |
| `mascot/logo-{512,256,128,64}.png` | Logo mark sizes | `web/public/mascot/` |
| `mascot/favicon-64.png` | Favicon on cream | `web/app/icon.png` |
| `icons/step-{write,answer,split}-{512,256}.png` | Step icons used in landing "how it works" | `web/public/mascot/` |
| `recap/recap-portrait-1080x1350.png` | Recap template, WhatsApp/Instagram | `web/public/recap/` (reference render) |
| `recap/recap-og-1200x630.png` | Link-preview template | `web/public/recap/` (reference render) |
| `recap/recap-templates.dc.html` | Editable source for both recap layouts | reference for the `[STRETCH]` recap generator |

## Recap placeholders
`{room name} {date} {1st name} {1n} {2nd name} {2n} {3rd name} {3n} {1i}{2i}{3i}` (initials) `{bold name} {sharp name} {unlucky name} {q} {p} {c} {tx}`. Unit is always "coins" on participant-facing output.

## Landing copy that depends on the economy (PRD §5A)
Pot pill on the hero shows "Pot 21" (10 people × play 2 + seed 1). Change the number, not the wording.

## Not included (by design)
Participant / host screens (final in `docs/screens.html`), dark theme, any extra animation beyond the coin flight.
