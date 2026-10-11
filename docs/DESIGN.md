# Kokonad — Design System

Source of truth for how the app looks and behaves. Claude Code implements these tokens as CSS variables / Tailwind theme and reuses the components below; it does not invent new colors, radii, or motion. Reference implementations: `docs/mockup-v2.html` (interactive flow) and `docs/screens.html` (all states).

## 1. Personality
Warm, playful, quick. A coconut that's just been surprised. The app should feel like a game night, not a finance product. Rules of thumb: big type, few elements per screen, one thing moving at a time, nothing that looks like a dashboard on the participant side.

## 2. Tokens

### Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#FBF3EA` | page background |
| `--bg-2` | `#F6E9DB` | subtle fills, tracks, disabled |
| `--card` | `#FFF9F3` | cards |
| `--surface` | `#FFFFFF` | inputs, rows, chips |
| `--line` | `rgba(59,31,20,.08)` | borders |
| `--ink` | `#3B1F14` | primary text (coconut brown) |
| `--ink-2` | `#7A5A4C` | secondary text |
| `--ink-3` | `#A88C7E` | tertiary text, captions |
| `--coral` | `#FF6B4A` | primary action, timer, live badge, selection |
| `--coral-d` | `#E85A3A` | primary hover, timer under 5 s |
| `--orange` | `#E07A3F` | mascot, secondary accents |
| `--peach` | `#FFE3D2` | soft fills, selected option background tint |
| `--peach-2` | `#FFD1BA` | selected borders on host list |
| `--gold` | `#F2B72B` | coins, pot, winner rows, first place |
| `--gold-d` | `#D99A12` | coin shading, first-place rank |
| `--green` | `#3C9D5D` | gains (+4.2) only |
| `--danger` | `#D8553F` | destructive/dispute confirm only |

Option colors (fixed order, same on phone and host bars): blue `#7CC1F5`, coral `#FF6B4A`, yellow `#F7C948`, purple `#B9A2F0`, mint `#A8E6CF`, peach `#FFB08F`. Option 1 is always blue, option 2 always coral, etc., so a participant can glance at the projector and match.

Avatar colors for initials: purple `#B9A2F0`, yellow `#F7C948`, peach `#FFB08F`, pink `#F9A8C9`, blue `#7CC1F5`, mint `#A8E6CF`, aqua `#9AD0CC`, sand `#FFD1BA`. Assigned by hash of address; text always `--ink`.

Background blobs: two radial gradients of `#FBE0CF` at opposite corners, 60–70% falloff. Never more than two per screen.

### Typography
Font: **Nunito** (Google Fonts), weights 700 / 800 / 900. Fallback: "Avenir Next Rounded", "Segoe UI", system-ui.

| Style | Size / weight | Use |
|---|---|---|
| Display | 56 / 900, letter-spacing −.04em | result number (+4.2), projector countdown |
| H1 | 30 / 900, −.02em, line-height 1.1 | join tagline, "Session over" |
| H2 | 24 / 900, −.015em, 1.15 | question text |
| H3 | 16 / 900 | card titles, row names |
| Body | 14 / 800 | buttons (15–17), chips, rows |
| Caption | 12–13 / 700, `--ink-3` | pot meta, hints, fine print |
| Code | 34 / 900, letter-spacing .16em | room code (host sidebar); 26 / 900 / .28em in the join input; projector: clamp(56px, 10vw, 150px) |

Numbers that change (pot, balance, timer, counts) use `font-variant-numeric: tabular-nums`.

### Shape & space
- Radius: cards 22px, buttons 999px (pill), inputs 18px, option cards 18px, rows 14px, chips 999px, phone-safe bottom padding 20px.
- Spacing scale: 4, 6, 8, 10, 12, 14, 16, 18, 22, 28.
- Borders: 1px `--line` on cards; 2px on option cards (transparent → `--coral` when selected).
- Shadows: cards have none. Things you press sit on a 4px ledge of their own darker colour and go down 3px when pressed (`.ledge` in `globals.css`): the primary button's ledge is `--coral-d`, a white tile's is `rgba(59,31,20,.10)`. Changed 12 Oct 2026 from the soft glow under the primary button, so a press feels like a game piece.
- Background: the two blobs are on `body`, so every screen has them, not only the landing page.

### Breakpoints
- Participant: designed at 360–392px, must work at 320px. Max width 440px centered on larger screens.
- Host: ≥ 1024px, sidebar 260px + fluid main. Below 1024px the host view is usable but not optimized; show a hint "best on a laptop".
- Projector: 16:9, everything scales with `clamp()`/vw.

## 3. Components

| Component | Anatomy | States |
|---|---|---|
| **Button / primary** | coral pill, white 900 text, 16px vertical padding, optional leading icon | default, hover (`--coral-d`), pressed (scale .98), disabled (45% opacity, no shadow), loading (spinner replaces label) |
| **Button / secondary** | white pill, `--line` border, ink text | same |
| **Button / soft** | `--peach` pill, ink text | same; used for "Suggest questions", "Use your own wallet" |
| **Pill** | white, `--line`, 13px 800, ink-2 with bold ink values | static |
| **Code input** | 26px 900 uppercase, .28em tracking, centered, auto-uppercase, 6 chars | empty, typing, invalid (coral border + shake once), valid |
| **Option card** | white, 2px border, 6×38 color swatch left, 16px 900 label | default, hover (−1px), selected (coral border, `#FFF0EA` fill, ✓ badge top-right), disabled, correct (gold border, `#FFF4D6`), wrong (55% opacity) |
| **Timer ring** | 60px, 6px stroke, `--bg-2` track, coral progress, number centered | running, under 5 s (`--coral-d`), done (empty ring, "0") |
| **Pot bowl** | SVG coconut half-shell, gold fill rises with pot / max pot, number right, meta caption | empty, filling, full |
| **Feed line** | avatar 24px + "Name has answered", fades in from below | one line at a time; replaces, doesn't stack |
| **Row (participant)** | avatar, name, pick, gain | default, me (2px coral outline), winner (gold tint, +amount green), loser (55%) |
| **Result hero** | card with label, display number, why-text, mascot right | win (green number, "Nice one!"), lose (ink-3 number, "Not this time"), sat out |
| **Stand (podium)** | rank, avatar, name, amount pill | first (gold tint, tallest), second, third (peach tint) |
| **Title card** | emoji + title, name, one-line reason | static |
| **Host sidebar** | logo, code card, question list, tx line, mascot peeking | question states: draft, sealed, next, live, done |
| **Distribution bar** | label + track + count + % | hidden (— before reveal), revealed, clickable (hover coral), winner (gold) |
| **Stat card** | 38px icon tile in peach, value, label | static |
| **Projector panel** | caption, display number/text, mascot | waiting (people count), live (countdown), locked ("Time's up"), resolved (outcome + pot), closed (🏆 + podium line) |
| **Toast** | ink background, white text, bottom center, 3 s | info, error (coral) |
| **Sheet** | bottom sheet on phone, centered modal on desktop, 22px top radius | login, confirm dispute, error |

## 4. Motion
Changed 11 Oct 2026 at the builder's request: a community game has to feel alive, so motion is no longer limited to one moment. The rules that replace "nothing else bounces":

- **Motion explains a change of state.** Someone joins, an answer is sealed, the pot grows, answers open, the result lands. If nothing changed, nothing moves (the one exception is the slow idle turn of the host's pot bowl).
- **One celebration stays one.** Coins flying from the result number to the balance pill on a win (10 coins, 700–1300 ms, cubic-bezier(.2,.7,.2,1)) is still the only celebratory animation. `components/coins.ts` is not to be restyled casually; the e2e suite counts its coins.
- **Money figures are never tweened.** A number that stands for coins shows the chain's value or nothing (CLAUDE.md rule 1). Bars, bowls and rings may ease; digits may not count up.
- **Enter, don't linger.** Screens and list items animate in (150–350 ms, ease-out, a soft spring for people and coins). No exit animations on anything a test or a person can press: a leaving node that is still mounted is a second button.
- **3D is for the host's screen only.** The pot bowl (`components/pot-scene.tsx`, three.js) is loaded on demand on `/host/[code]`. Participant phones never download or run it; they get the flat bowl.
- **`prefers-reduced-motion`** is honoured everywhere: movement is dropped, fades and progress (timer ring) stay, coins become a 200 ms tick, the 3D bowl stops turning.
- Libraries, one job each: `motion` for React screens, `three` for the bowl, `gsap` for tweening the bowl's three.js objects (which are not React elements). Plain CSS keyframes for the server-rendered landing page. Nothing else.

## 5. Copy rules
- English, sentence case, short. Buttons are verbs: "Enter room", "Grab 20 coins", "Lock answer", "Set result", "Open question 2", "Share recap".
- Participant screens never use: wallet, gas, transaction, sign, hash, chain, on-chain, token, address, confirm. Use: account, coins, sealed, locked, in your balance, "setting up your account".
- Host screens may say "sealed on-chain" once (in the seal confirmation) because hosts asked for it; otherwise same vocabulary.
- Money: "coins", never "KOKO" on participant screens. Amounts with one decimal max ("+4.2").
- Time: "12s", "60-second timer", "Result can be disputed for 47s".
- Errors say what to do: "Room not found. Check the code with your host." / "Couldn't seal your answer. Tap to try again."
- Never blame the participant: "Time's up, you sat this one out" not "You missed it".

## 6. Mascot usage
Rewritten 12 Oct 2026: the first build used the mascot on two screens and the logo on one. Both are now components (`components/brand.tsx`, `components/mascot.tsx`) and every screen uses them.
- Logo mark (coconut + three lines) at 34px next to the wordmark, on every screen. Participant screens in a room show the mark alone (30px) beside the room pill, to leave the width for the balance.
- The mascot is a character with a pose per moment. `<Mascot mood>` picks one of the four drawn poses and nothing else; a new pose pops in (a change of state), and between changes it idles in place: `sleepy` and `oops` breathe, `surprised` nods, `happy` hops.

| Moment | Pose |
|---|---|
| join, sign in, name entry, finding a room, a live question (host stage, big screen "Time's up!") | `surprised` |
| a valid code or name typed, answer sealed, a win, players in the room, result set | `happy` |
| a loss, room not found, something failed, nobody right | `oops` |
| lobby, empty room, sat a question out, out of plays | `sleepy` |

- Peeking from a corner, partially clipped, at 150px on lobby and host sidebar. Never centered on a busy screen.
- Centered and large only on: join screen, projector waiting screen, result hero (96px).
- Poses (assets to generate from the base logo): `surprised` (default), `happy` (win: eyes as arcs), `oops` (lose: one line, small mouth). If only one pose exists, use it everywhere; do not draw new faces in code.

## 7. Screens checklist
Participant: join · login sheet · setting up account · lobby · question · sealed · time's up (sat out) · reveal · result win · result lose · dispute confirm · podium · room not found · room closed · joined mid-question.
Host: landing · sign in · create room · build questions · sealed/lobby · live · reveal/set result · distribution · closed/recap · error (seal failed).
Projector (`/host/[code]/screen`, built 12 Oct 2026, opened from the host sidebar): waiting · live · time's up · resolved · standings between questions. It has no controls and needs no account.

All of these appear in `docs/screens.html`.
