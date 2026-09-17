# Kokonad — Product Requirements Document

> Live guessing games for community events, where the prize pot settles itself.
> "Kahoot for things that haven't happened yet, with a prize that doesn't wait."

| | |
|---|---|
| Hackathon | Monad Metropolis (1 Sep – 13 Oct 2026), Track 03 Social, Attention & Culture |
| Team | Solo. Member of DevWeb3Jogja (official Metropolis community supporter) |
| Chain | Monad testnet, chain ID 10143. Testnet only, no real token |
| Status | v2, 16 Sep 2026 |
| Tags | `[MVP]` required · `[STRETCH]` if time allows · `[OUT]` not in scope |

This document is the source of truth for Claude Code. If it conflicts with any other file in the repo, this document wins. Companion: `ARCHITECTURE.md` (components and sponsor integrations), `../CLAUDE.md` (conventions).

---

## 1. Problem

Community events (meetups, game tournaments, watch parties, classes) are full of small moments worth a prize or a friendly stake, but no tool makes that cheap enough and fair enough to do ten times in one evening.

1. **Small prizes never arrive cleanly.** Organizers have to check who was right, who was first, collect account numbers, and transfer one by one. For small prizes the admin cost exceeds the prize, so organizers do fewer prize moments.
2. **Guessing games have no stakes that feel real.** Kahoot gives points, but points never move from one person to another.
3. **Fairness can't be proven.** "Why did she win, I was first?" Organizers can't show ordering or prove the question wasn't changed.
4. **Hosts need prep time.** Writing 10 relevant questions takes effort, so it often doesn't happen.

The real competitor isn't Polymarket. It's **manual betting in a WhatsApp group**: someone is the bookie, someone holds the money, someone forgets to pay.

## 2. Solution

One tool that turns any moment at an event into a prize question in 10 seconds, with a pot that settles the same second to whoever earned it, under rules that can be proven.

- Host writes questions on a laptop; participants answer on phones via link + room code.
- Every participant holds a deposit (from the host in sponsored rooms, their own in pooled rooms). Each question charges one **play** from everyone in the room into that question's pot; answering burns the play, sitting out forfeits it. The host may add a **seed**. Whoever is right splits the pot (see §5A).
- Questions are sealed (committed) before they open, answers stay hidden until time is up, the host sets the result, the pot is split immediately.
- The oracle is the room: everyone sees the same thing happen. Sanctions for a cheating host are social; the contract only makes every trace visible.

### Positioning
- vs Kahoot: the pot actually moves, and the outcome hasn't happened yet.
- vs Polymarket: born in a room, resolved by people you know, over the same night.
- vs the WhatsApp group: no bookie, nobody holds money, nobody forgets to pay.

## 3. Why Monad

1. **Small-transaction economics.** Pots of 8 coins, seeds of 5, plays of 1–2. One session of 10 people × 10 questions × (answer + reveal + claim) ≈ 300 tx. At $0.05/tx that's $15, more than the prizes. This product only exists where fees round to zero. **README must show these numbers from a real session.**
2. **Speed is part of the game.** "First N correct" is only fair when blocks are fast and ordering is unambiguous. A 30-second timer with 15-second confirmations isn't playable.
3. **First users are Monad's own community.** DevWeb3Jogja is an official Metropolis supporter; tester sessions run there.
4. **Bottom-up adoption.** People hold their first Monad wallet because they won a guessing game at a meetup, not because they read a whitepaper.

## 4. Users

| Persona | Device | Crypto literacy | Patience for learning |
|---|---|---|---|
| **Host** (organizer, or anyone running the moment) | Laptop, often on a projector | A little | 2 minutes |
| **Participant** | Phone, plain browser (Chrome/Safari) | Assume none | 30 seconds |

The host may also answer (see 6.6).

## 5. Scope

### `[MVP]`
- Room with a 6-character code; only people with the code can join.
- Social / passkey login via Dynamic embedded wallet; "use your own wallet" option for hosts.
- Play / Correct economics with sponsored and pooled funding (§5A). Mock ERC-20 (`KOKO`) on testnet; native gas dripped automatically (see ARCHITECTURE §2).
- Questions: 3 answer templates × 2 payout rules (§6.3).
- Per-room play price; per-question host seed.
- Commit-reveal for questions (host) and answers (participants); reveal sent automatically by the client.
- Host sets the result; 60-second dispute window.
- Host reputation: 3 numbers.
- Host screen (laptop) and participant screen (phone), one responsive app; projector view.
- LLM-assisted question builder from free text / event schedule.
- Envio indexer: live feed, leaderboard, host stats, session recap.
- Mera PRF: commit-reveal salt derived from the passkey (see ARCHITECTURE §4; dropped if it conflicts with Dynamic).

### `[STRETCH]` (priority order)
1. Pot rollover when nobody is correct.
2. "Over/under" numeric template.
3. Tournament bracket (question series auto-built from a match schedule).
4. Chainlink CRE auto-resolver for one market type (score guessing).
5. Auto-generated session recap image for sharing.
6. ERC-8004 agents as participants ("beat the agent"), host toggle.

### `[OUT]`
Mainnet, real token, fees, adjudicated disputes, native apps, multi-chain, launchpad, streaming.


## 5A. Economics — plays, correct tokens, and where coins come from

The testnet flow is the mainnet flow with a different token. Three internal units, two of which participants never see by name:

| Unit | What it is | Shown to participants as |
|---|---|---|
| **coins** | the money. Mainnet: a fixed amount of a stablecoin/MON set by the host (e.g. 1 coin = 0.1 USDC). Testnet: 1 coin = 1 `KOKO` | "coins" |
| **Answer** (play) | the right to answer one question. Minted per question to everyone in the room; burned when you answer; expires unused | "your play" / "Time's up, your 2 coins stayed in the pot" |
| **Correct** | proof you were right on a question. Minted only by `resolve`; your share of that question's pot; your podium rank | "✓ 8 correct" |

Answer and Correct are internal balances in `Room` with `AnswerMinted / AnswerBurned / CorrectMinted` events (an ERC-1155 view is `[STRETCH]`).

### How a session flows
```
join       deposit coins (pooled) or receive them from the host (sponsored) → deposit balance. No Answer yet.
open Q_i   contract charges the play price (e.g. 2 coins) from every participant still in the room
           → mints 1 Answer_i each → the coins go straight into pot_i, plus the host seed
commit     burn Answer_i, store hash(answer, salt)
lock       unburned Answer_i expire; their coins are already in pot_i, so people who sat out fund that question's winners, that second
resolve    mint Correct_i to everyone right (or the first N); pot_i split evenly among Correct_i holders
close      remaining deposit balances are refunded to their owners. No end-of-session forfeit pool: the forfeit happens per question
```

The host can open 5, 10 or 17 questions; each open charges one play from everyone. If a participant's deposit runs out they stop receiving Answers (they watch) until they top up (pooled) or the host adds budget (sponsored). Whatever is left at close goes back, so a full player is never punished for a short session.

### Where the coins come from: funding modes
| Mode | Who deposits | Use | Scope |
|---|---|---|---|
| **Sponsored** | the host, from the event's prize budget; every participant gets the same starting deposit | community events. A skill-based prize distribution: participants never pay | `[MVP]`, demoed |
| **Pooled** | each participant, the same amount, on join | watch parties, friend groups | `[MVP]` in contract (same code path), demoed on testnet, jurisdiction-gated with real money |
| **Mixed** | participants deposit, host adds seeds | anything in between | falls out of the two above |

The contract doesn't care where a deposit came from; `join` only ensures the participant has a deposit balance.

### Worked example (pooled, 4 people, deposit 20, play price 2, 10 questions, seed 6 on Q8)
A right 8×, B right 4×, C leaves after Q5 (right 3×), D never answers.

| Q | pot | note |
|---|---|---|
| 1–5 | 8 | 4 × 2. D's play expires every time, so winners get more |
| 6–10 | 6 (+6 on Q8) | C has left, 3 people charged |
| 7 | 0 | nobody right → the 2 coins go back to all three |

| | Correct | charged | won | deposit refunded at close | final | net |
|---|---|---|---|---|---|---|
| A | 8 | 18 | 42.67 | 2 | 44.67 | +24.67 |
| B | 4 | 18 | 16.67 | 2 | 18.67 | −1.33 |
| C | 3 | 10 | 10.67 | 10 | 20.67 | +0.67 |
| D | 0 | 18 | 0 | 2 | 2 | −18 |

Paid out 86 = deposits 80 + seed 6. Sitting out loses; playing and being right wins; leaving early keeps what you didn't play.

### Rules that come with it
1. **Play price** is set per room at creation (default 1 coin sponsored, host's choice pooled). Independent of question count.
2. **`leave` is permanent**: remaining deposit is refunded, no re-join to the same room. Closes "join, peek, leave, come back".
3. **Late join**: you're in from the next question; nothing special.
4. **Nobody right**: plays are refunded to everyone charged (including those who sat out), seed back to host. Rollover = `[STRETCH]`.
5. **Rounding dust** goes to the next question's pot; on the last question, to the host.
6. **Adding questions mid-session** is just `commitQuestion` + `openQuestion`; the economy doesn't change. Batch-sealing before the event is a convenience, not a requirement.
7. **No withdrawal after the first question opens** except via `leave`. Before that, `leave` is a plain refund (cancel).
8. **Seed** is still useful in pooled mode: with everyone right, an unseeded pot just returns everyone's play; a small seed makes "everyone right" still feel like a win.

### Budget the host sees (sponsored)
`starting deposit × expected people + Σ seeds`, e.g. 20 × 10 + 45 = 245 coins (≈ 24.5 USDC at 0.1). Deposited before the room opens; deposits for people who never join, and unspent seeds, return to the host at close.

## 6. Game rules

### 6.1 Room
- Host creates a room → gets a 6-character code and link `kokonad.xyz/r/ABC123`.
- Participants join via link or code. Joining = on-chain check-in (one tx; gas dripped).
- MVP limit: 50 participants per room.
- A room holds a list of committed questions; the host opens them one at a time.

### 6.2 Pot
- `playPrice ≥ 0` per room, `hostSeed ≥ 0` per question, `require(playPrice > 0 || hostSeed > 0)`.
- At `openQuestion`, every participant with `deposit ≥ playPrice` is charged and receives 1 Answer; the coins move into `pot_i`. Participants below the price receive nothing and can't answer.
- Pot_i = playPrice × participants charged + hostSeed.
- Platform fee = 0.

### 6.3 Answer templates and payout rules

Answer templates (host picks one per question):
| Template | Participant input | Correct if |
|---|---|---|
| `CHOICE` | pick 1 of 2–6 options | option == outcome |
| `NEAREST` | number | always a winner: closest to outcome; ties → everyone at the same distance |
| `EXACT` | number (text = stretch; normalized lowercase/trim) | exact match |

Payout rules (host picks one per question):
| Rule | Winners | Split |
|---|---|---|
| `SPLIT` | everyone correct | pot split evenly |
| `FASTEST_N` | first N correct by on-chain reveal order (block, then tx index) | pot split evenly among N; if fewer than N correct, among those |

"Fastest" = transaction order in Monad blocks. README states this is fair-by-block, not millisecond.

### 6.4 Lifecycle of one question
```
DRAFT      host writes it; contract stores hash(text, options, template, rule, n, hostSalt)
OPEN       host opens: question revealed on-chain; every participant charged playPrice → Answer_i minted → pot_i funded (+ seed)
           timer T seconds (default 30; options 15/30/60/120)
           participants: burn Answer_i + submit hash(answer, salt)
LOCKED     timer over; unburned Answer_i expire (their coins stay in pot_i)
REVEAL     participant clients auto-send reveal(answer, salt) within window R = 90 s
           everyone's answers (including host's) shown on screen
RESOLVED   host sets outcome; contract mints Correct_i to winners; 60 s dispute window starts
SETTLED    dispute window passes → pot_i split evenly among Correct_i holders (push if ≤ 20, else claim)
VOIDED     cancelled (disputes ≥ 1/3 of answerers, host timeout, or nobody right) → plays refunded to everyone charged, seed to host
```

### 6.5 Edge cases
- Nobody right → `VOIDED`: plays refunded to everyone charged, seed back to host. (Rollover = stretch.)
- Participant doesn't reveal within R → counted as wrong; the Answer was already burned, so nothing else to do. UI warns before commit.
- Participant sits out → Answer expires; their play stays in the pot. UI: "Time's up. Your 2 coins stayed in the pot."
- Deposit below play price → not charged, no Answer, watches. UI: "You're out of plays. Ask the host / top up."
- Host doesn't resolve within 24 h → anyone may call `voidByTimeout`.
- Disputes ≥ 1/3 of answerers within 60 s → `VOIDED`; Correct_i burned.
- Host closes the room → every unsettled question is voided; all deposit balances refunded.
- `leave` mid-session → deposit refunded, address blocked from re-joining this room.
- Participant joins mid-question → charged from the next question; cannot answer the open one.

### 6.6 Host plays along
- Room setup has a `hostPlays` switch.
- If `hostPlays = true`: the host's answer goes through the same commit-reveal and is shown at reveal; the host **cannot receive any share of hostSeed** (only of the plays in the pot). Dispute window is always active.
- The dispute window is active on every question, not only when the host plays.

### 6.7 Host reputation
Three on-chain numbers shown to participants when they enter a room: sessions run, questions resolved, questions voided by dispute. Stored in `HostRegistry` (adapted from the existing ERC-8004 Reputation pattern).

## 7. User journeys

### Host
1. Open the app on a laptop → sign in → "Create room".
2. Room setup: name, `hostPlays`, funding mode (sponsored / pooled), coin (KOKO on testnet; on mainnet a stablecoin/MON and coin value), play price (default 1), starting deposit per participant (default 20).
3. Paste schedule/topic → LLM suggests 8–12 questions with templates and options → host edits, removes, adds.
4. Per question: set hostSeed, payout rule, timer. Defaults: seed 5, SPLIT, 30 s. The builder shows the running budget (starting deposit × expected people + Σ seeds) in sponsored mode.
5. "Seal all" → one batched commit tx that also deposits the budget (sponsored). More questions can be committed and opened later.
6. Lobby screen: big code, people joining, "Open next question".
7. While open: big screen shows question, timer, number of answers (never contents).
8. After reveal: distribution shown. Host clicks the correct option.
9. 60 s dispute window → distribution → screen shows who got what.
10. End: podium and recap.

### Participant
1. Open link / type code.
2. Sign in with Google or passkey (wallet created behind the scenes). Display name chosen by the participant.
3. Sponsored: "Grab 20 coins" credits the host's starting deposit to the participant. Pooled: "Put in 20 coins" deposits their own (on testnet minted as KOKO). Gas is dripped silently on first sign-in.
4. Lobby: wait for the host, see who's in.
5. Question appears: balance drops by the play price, pot bowl fills at once. Pick/enter answer → one tap (burn Answer + commit in one tx via delegated signing, no popup).
6. Timer over → app reveals automatically → everyone's answers shown.
7. Result set → coin animation → balance updates. "Disagree" available for 60 s.
8. Leaderboard between questions, podium at the end.

## 8. Technical requirements

### 8.1 Contracts (Solidity, Foundry)
```
contracts/
  KokoToken.sol        mock ERC-20; on testnet anyone can mint (simulates having a stablecoin to deposit)
  RoomFactory.sol      createRoom → deploys/registers a Room; unique 6-char code
  Room.sol             participants & deposits, Answer/Correct balances, questions, pots, commit/reveal, resolve, dispute, settle, void
  HostRegistry.sol     3 reputation numbers per host
```

Core structures in `Room.sol`:
```solidity
enum Template { CHOICE, NEAREST, EXACT }
enum Rule { SPLIT, FASTEST_N }
enum Status { DRAFT, OPEN, LOCKED, REVEAL, RESOLVED, SETTLED, VOIDED }

struct Question {
  bytes32 commitHash;      // hash(text, options, template, rule, n, hostSalt)
  string  text;            // filled at OPEN
  string[] options;        // for CHOICE
  Template template;
  Rule rule;
  uint8   n;               // for FASTEST_N
  uint128 hostSeed;
  uint128 pot;             // playPrice × charged + hostSeed
  uint32  charged;         // participants who received Answer_i
  uint64  openAt; uint64 lockAt; uint64 revealUntil; uint64 disputeUntil;
  Status  status;
  bytes32 outcome;         // normalized outcome
  address resolver;        // host by default; CRE workflow address for flagged questions (stretch)
  uint32  answerers; uint32 revealed; uint32 disputes;
}

struct Participant { uint128 deposit; bool left; uint32 correctTotal; }
mapping(address => Participant) participants;
mapping(uint256 => mapping(address => bool)) hasAnswerToken;   // Answer_i minted and not yet burned
mapping(uint256 => mapping(address => bool)) hasCorrectToken;  // Correct_i

struct Answer {
  bytes32 commitHash;      // hash(answer, salt)
  bytes32 answer;          // filled at reveal
  uint64  revealBlock; uint32 revealIndex;   // for FASTEST_N
  bool    revealed; bool claimed;
}
```

Public functions:
| Function | Caller | Notes |
|---|---|---|
| `join(code, displayName)` | participant | check-in; room open, < 50; sponsored: credits starting deposit from room budget; pooled: pulls the deposit from the participant |
| `leave()` | participant | refunds remaining deposit; permanent |
| `topUp(amount)` | participant (pooled) / host (sponsored, for everyone) | adds deposit |
| `registerSessionKey(key, expiry)` | participant | fallback path if Dynamic delegated access is unavailable |
| `commitQuestions(bytes32[] hashes)` | host | batch |
| `openQuestion(id, text, options, template, rule, n, salt, seed, timer)` | host | verifies hash; charges playPrice from every participant with enough deposit, mints Answer_i, funds pot; transfers seed |
| `commitAnswer(id, hash)` | participant (or session key) | burns Answer_i; once per participant per question |
| `revealAnswer(id, answer, salt)` | participant (or session key) | within R; records block + index |
| `resolve(id, outcome)` | host / resolver | mints Correct_i to winners; opens dispute window |
| `dispute(id)` | answerer | ≥ 1/3 → VOIDED |
| `settle(id, address[] orderedWinners)` | anyone | after disputeUntil; contract verifies order; push if ≤ 20 winners, else mark claimable |
| `claim(id)` | winner | pull |
| `voidByTimeout(id)` | anyone | host silent 24 h |
| `closeRoom()` | host | void everything unsettled; refund all deposit balances; return unused budget to host |

Minimum security: ReentrancyGuard; pull-payment for > 20 winners; `uint128` amounts; no owner function can withdraw funds; EXACT normalization done client-side with hashes compared on-chain; `FASTEST_N` ordering sorted off-chain and verified on-chain (monotonic `revealBlock/revealIndex`).

### 8.2 Frontend (Next.js, wagmi/viem, one responsive app)
- Routes: `/` landing + create room · `/r/[code]` participant · `/host/[code]` host · `/host/[code]/screen` projector (host view without controls).
- Participant: one screen, one action. Required elements: big question, large colored option buttons, circular timer, live pot (coconut bowl filling), answer count, "X has answered" feed (never contents), settle animation (coins flying to balance), balance.
- Host: question builder (LLM), question list, one-click per phase, distribution bars that are clickable to set the result, host's own answer shown at reveal.
- Design: light warm theme derived from the logo. Tokens: bg `#FBF3EA`, ink `#3B1F14`, coral `#FF6B4A` (primary actions), orange `#E07A3F`, gold `#F2B72B` (coins/pot), green `#3C9D5D` (gains). Option colors: blue `#7CC1F5`, coral, yellow `#F7C948`, purple `#B9A2F0`. Font: Nunito (weights 700–900). Mascot: the coconut. Reference: `docs/mockup-v2.html`.
- All UI copy in English. No "wallet", "gas", "transaction", "hash" on participant screens.
- Mobile-first; low-end phones in a browser.

**Realtime layer (cosmetic, never truth).** A small WebSocket server syncs what can't wait for blocks: identical countdown on every screen, "X has answered" feed, animation triggers. It **never** decides money, ordering, or results; those come from the chain via Envio. If the socket dies, the app falls back to polling the indexer. Details in `ARCHITECTURE.md` §5.

### 8.3 Integrations
| Service | Role | Bounty | Decision |
|---|---|---|---|
| Dynamic | social/passkey login, embedded wallet, **delegated access** for commit + reveal without popups | $5K | `[MVP]` |
| Gas drip (own) | sends 0.1 testnet MON to each new participant wallet on first sign-in, tops up below 0.02 before each question | — | `[MVP]` |
| Envio HyperIndex | derived entities: Room, Question, Answer, Participant, Host, SessionStats | $1K | `[MVP]` |
| Mera PRF | commit-reveal salt = PRF(passkey, namespace = room:question); reveal from any device; salt never stored | $2.5K | `[MVP]` conditional: coexistence with Dynamic tested on **day 1–2**; if it conflicts → dropped, CRE becomes third bounty |
| Chainlink CRE | auto-resolver for one market type | $3K | `[STRETCH]` |
| LLM (KIMI or Claude) | question builder | KIMI $3K credits (needs blog post) | `[MVP]` feature; bounty optional |
| RPC | Quicknode / Chainstack (free for participants) | — | use, never public RPC |
| Monad Foundation Community Team | tag DevWeb3Jogja in the portal profile | $5K | check the dropdown |

Not pursued: Kuru, Perpl, Agora, Aurora, Nansen, MetaMask, Privy (conflicts with Dynamic), Cleanverse, Alchemy.

### 8.4 Non-functional
- Tap → confirmation < 1 s (target), shown as a number in the UI.
- 10 people × 10 questions with no RPC errors.
- Auto-reveal retries 3× within window R.
- All salts client-side (Mera PRF, or in-memory/localStorage encrypted as fallback).
- No browser storage for game state; state comes from chain + indexer. Browser storage only for per-viewer conveniences (display name, salt fallback).

## 9. Success metrics

Hackathon:
- 1 real session with ≥ 8 participants, ≥ 8 questions, 0 wrong payouts, recorded.
- Numbers for README: total tx, average tap→confirmation, total coins moved.
- 1 quote from a DevWeb3Jogja admin.

Product (post-hackathon): sessions per host per month, participants per session, repeat hosts.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Regulation | Sponsored mode is what we demo: participants never pay, so it's a skill-based prize distribution. Pooled mode with real money is wagering-adjacent; on testnet it's harmless and we say so. Pitch says both things first |
| Reveal fails (network, phone sleeps) | 90 s window, retries, clear warning; the play was already burned, so it counts as wrong |
| Host cheats | oracle = the room; sealed questions; open answers; dispute; reputation. Social sanction beats contracts at local scale |
| Mera conflicts with Dynamic | test day 1–2; fallback CRE |
| RPC limits with 10 people at once | sponsored RPC |
| No real session | dates locked in week 1 |
| Scope creep | new features go to STRETCH, never to MVP after week 1 |

## 11. 4-week plan (solo)

| Week | Contracts | Frontend | Integrations & community |
|---|---|---|---|
| 1 (16–22 Sep) | KokoToken, Room (commit/reveal/resolve/settle), Foundry tests | Participant screen with **mock data** until it feels right; basic host screen | Test Dynamic delegated + Mera coexistence (day 1–2). Gas drip service. Check Community Team dropdown. Lock 2 tester dates |
| 2 (23–29 Sep) | HostRegistry, void/timeout, FASTEST_N verification | Wire to contracts; LLM builder; settle animation | Envio schema + handlers; WebSocket. **Tester session 1 (3–5 people, bug hunt)** |
| 3 (30 Sep–6 Oct) | Self-audit, gas, edge cases | Polish, podium, recap, responsive | Stretch #1–2 if time. **Registration closes 6 Oct** |
| 4 (7–13 Oct) | Final deploy, verify contracts | Freeze | **Tester session 2 (≥ 8 people, recorded)**. Demo video ≤ 3 min, pitch ≤ 2 min, README (architecture, addresses, why Monad with numbers, AI disclosure, MIT), logo. Submit before 13 Oct 23:59 ET |

Definition of done per week: week 1 = one question playable end-to-end on testnet from two browsers; week 2 = a 5-person session with no manual intervention; week 3 = no open P0 bugs; week 4 = submitted.

## 12. Path forward (for the pitch, not scope)
1. **Now:** event organizers host sponsored rooms; questions for the people in the room.
2. **Next:** anyone hosts for their own group: watch parties, classes, office teams. Host reputation becomes a prerequisite; CRE resolves markets with a data source.
3. **Later:** high-reputation hosts open markets to the public; the reputation is the asset.

## 13. Compliance
- MIT license. README states: built with Claude Code and other AI tools; pre-hackathon code used as reference (PredictionPool, ERC-8004 registries, EIP-712 proofs, design system) is identified explicitly; everything demoed is built inside the window.
- No real token, no wash trading, no fake volume. Simulated wallets (if used for load tests) are labeled "simulated", never "users".
- No third-party IP. Original coconut mascot.

## 14. Open decisions
1. Starting deposit (default 20), play price (default 1 sponsored / 2 pooled), coin value on mainnet (default 1 coin = 0.1 USDC).
2. `EXACT` accepts numbers only in MVP (text = stretch).
3. Display name: free text (default) or from the Google account.
4. Domain: `kokonad.xyz` used everywhere until decided.
