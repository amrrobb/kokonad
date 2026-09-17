# Claude Design — prompts for Kokonad

Run these in order in one Claude Design project. Upload or link the `docs/` folder first (design system import), then paste each prompt as its own message. Keep the HTML files in `docs/` as the source of truth; anything approved in Claude Design gets exported back into `docs/`.

---

## 0. Project setup (do once)

**Import design system from:** `docs/DESIGN.md`, `docs/mockup-v2.html`, `docs/screens.html`, `docs/assets/logo.png`. If linking a GitHub repo, link the `docs/` subdirectory, not the repo root.

**Project context message (paste first):**

```
This project is Kokonad: live guessing games for community events, running on Monad testnet. A host writes questions on a laptop; participants answer from phones via a room code; the contract splits the pot the moment the host sets the result. It's for a hackathon (Monad Metropolis, Track 03 Social, Attention & Culture), solo builder, deadline 13 Oct 2026.

Source of truth for visuals: docs/DESIGN.md (tokens, components, motion, copy rules), docs/mockup-v2.html (interactive flow), docs/screens.html (every state). Follow them exactly: light warm theme, coral #FF6B4A primary, gold #F2B72B for coins/pot, green #3C9D5D only for gains, Nunito 700–900, pill buttons, 22px cards, the coconut mascot from docs/assets/logo.png.

Hard rules:
- All UI copy in English.
- Participant screens never use the words wallet, gas, transaction, sign, hash, chain, token, address. Say account, coins, sealed, in your balance.
- No discover feed, no categories, no public list of rooms. Rooms are private and joined by code.
- Exactly one celebratory animation in the app: coins flying to the balance on a win. Nothing else bounces.
- Do not redesign screens that already exist in screens.html; extend the system, don't replace it.
- Images in docs/reference/ are early concept art with Indonesian text; use them for mood only, never copy their text or their layout where it conflicts with screens.html.

Confirm you've read DESIGN.md by listing the six option colors in order and the one allowed animation, then wait for the next prompt.
```

---

## 1. Landing page (desktop + mobile) — 3 directions

```
Design the public landing page at kokonad.xyz. Give me three directions side by side, desktop 1440 and mobile 390 for each.

Content, in this order:
- Nav: logo + wordmark left, "Sign in" (secondary pill) right. Nothing else in the nav.
- Hero: headline "Guess together. The pot really moves." Subline: "Write a question in 10 seconds. The prize goes to whoever earned it, the moment you call it. Nobody checks, nobody holds money." Primary button "Create room →", secondary "Have a code? Join". Mascot large on the right.
- Three steps as cards: "Write a question" · "Friends answer from their phones" · "Pot splits the same second".
- One proof strip: "Built for rooms of 5–50 people. Runs on Monad."
- Footer: MIT · GitHub · "Made in Yogyakarta" (small).

Direction A: closest to docs/screens.html landing, refined.
Direction B: mascot-led, bigger illustration, more peach blobs, playful.
Direction C: quieter, more whitespace, editorial type scale, mascot small.

Keep every direction inside DESIGN.md tokens. No new colors. Show all three before I choose.
```

---

## 2. Mascot poses (asset)

```
Using docs/assets/logo.png as the exact character (fluffy orange coconut, round dark eyes, open mouth, three coral speed lines), create three poses as separate transparent PNGs at 1024×1024, same line weight and palette:

1. "surprised" — identical to the logo (baseline).
2. "happy" — eyes as upward arcs, mouth a small open smile, speed lines replaced by two small gold sparkles. Used on the result screen when the participant wins.
3. "oops" — eyes as flat lines, mouth a tiny "o", one drooping coral line. Used on the result screen when the participant loses. Gentle, never sad-sad.

Also export the baseline logo mark at 512, 256, 128 and 64 px, and a 1:1 favicon at 64 px with a cream #FBF3EA background.
```

---

## 3. Share recap image (asset template)

```
Design the image a participant shares after a session ("Share recap"), 1080×1350 (portrait) and 1200×630 (link preview). It's a template: the app will fill the values.

Content:
- Kokonad logo + wordmark, small, top-left.
- "Session over" as the title, then "{room name} · {date}".
- Podium block: 1st / 2nd / 3rd with initials avatars, names, and "+{n} coins". 1st in gold tint.
- Three title cards: "⚡ Boldest {name}", "🎯 Sharpest {name}", "🍀 Unluckiest {name}".
- Footer line: "{q} questions · {p} people · {c} coins moved · {tx} tx on Monad".
- Mascot "happy" pose bottom-right.

Mark every placeholder as {curly}. Use DESIGN.md tokens. It should look good screenshotted into a WhatsApp group.
```

---

## 4. Pitch deck (≤ 2 minutes, 8 slides)

```
Build an 8-slide pitch deck for a 2-minute video, on-brand with DESIGN.md (cream background, coral accents, Nunito, mascot). Big type, one idea per slide, almost no bullets. Content:

1. Title: "Kokonad" + "Live guessing games for community events, where the prize pot settles itself." Mascot.
2. The problem: "Small prizes never arrive cleanly." Three short lines: organizers check by hand · points don't move · nobody can prove who was first. Bottom: "The real competitor is the WhatsApp group where someone holds the money."
3. The moment: a phone showing the result screen (+4.2, coins flying) next to a laptop showing the host clicking the correct option. Caption: "Host calls it. Contract pays it. Same second."
4. How it works: sealed question → answers sealed → time's up → host sets result → pot splits. Five icons in a row, one line each.
5. Why Monad: three numbers as big type: "~300 tx per session" · "< 1 s tap → confirmed" · "fees that round to zero". One line under each.
6. Trust without an oracle: "For 20 people in one room, the best oracle is the 20 people." Sealed questions, open answers, 60-second dispute, host reputation.
7. Traction: "First users are Monad's own community." DevWeb3Jogja logo/name, "{n} people · {q} questions · {tx} tx · 0 wrong payouts" as placeholders, one quote placeholder.
8. Path forward: three steps: organizers host → anyone hosts for their group → high-reputation hosts open markets. Close with "kokonad.xyz" and GitHub.

Export as PPTX and as a PDF.
```

---

## 5. Demo video storyboard (≤ 3 minutes)

```
Create a storyboard for a 3-minute demo video as a one-page board: 10 frames, each with a thumbnail sketch in DESIGN.md style, a timestamp, what's on screen, and a one-line voiceover. Order:

0:00 Title card, one sentence.
0:10 Host on laptop: paste schedule → "Suggest questions" → edit → "Seal all".
0:35 Projector: room code; phones joining (screen-record a real phone).
0:50 Phone: "Setting up your account" → lobby → "Grab 20 coins".
1:05 Host: "Open question 1". Phone: question, timer, pot bowl filling, feed.
1:25 Phone: "Lock answer". Sealed state.
1:40 Time's up → reveal on phone and projector.
1:55 Host clicks the correct bar. Phone: +4.2, coins fly. Room reaction (real footage).
2:20 Two more questions, fast cut, including "first 3 correct".
2:40 Podium on projector; host recap numbers: "27 tx · avg 0.4 s · 41 coins moved". End card: kokonad.xyz.

Every frame must show a Monad interaction visibly (tx counter, confirmation time, or the recap numbers). Mark which frames are screen recordings and which are camera footage.
```

---

## 6. Interactive prototype for tester session 1 (optional)

Only if contracts aren't ready by the first tester session.

```
Turn docs/mockup-v2.html into a shareable interactive prototype I can send to 5 testers on their phones. Keep the flow and copy exactly as in the file; do not redesign. Add one thing: a "Send feedback" link at the bottom of the podium screen that opens a short form (what confused you, what felt slow, would you play again). Give me the shareable link.
```

---

## 7. Hand-off

After approving items 1–3:

```
Export the approved landing page as a single self-contained HTML file and the mascot poses and recap templates as PNG/SVG. Then hand off to Claude Code with this note: "Place landing at web/app/(marketing)/page.tsx using the existing tokens; assets go to web/public/mascot/ and web/public/recap/. Do not touch participant or host screens; they're built from docs/screens.html."
```

---

## What NOT to ask Claude Design for
- Redesigning the participant question / result / podium screens or the host live screen. They're final in `docs/screens.html`.
- Anything with categories, discover, leaderboards across rooms, or public browsing.
- A dark theme.
- New colors, a second font, or extra animations.
