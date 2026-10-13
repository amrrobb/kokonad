# 🥥 Kokonad

**Live guessing games for community events, where the prize pot settles itself.**

Kokonad is a web app for event hosts (meetups, tournaments, watch parties, classes) who want to turn any moment into a live guessing game in 10 seconds. The host writes questions on a laptop, participants answer from their phones via a link and room code, and once the host calls the result and a 60-second dispute window has passed, the smart contract on Monad splits the pot between everyone who was right. Nobody checks answers by hand, nobody holds anyone else's money, nobody forgets to pay.

If Kahoot is a quiz where the answer is already known, Kokonad is a guess about something that hasn't happened yet, with a pot that actually moves.

> Built for the **Monad Metropolis Hackathon**, Track 03 Social, Attention & Culture. Runs on Monad testnet (chain ID 10143) with a mock token; no real token exists.

| | |
|---|---|
| Live product | https://kokonad.robbyn.xyz (how to try it: ["Trying it as a judge"](#trying-it-as-a-judge)) |
| Demo video | _link to be added_ (its source is [`video/`](video/)) |
| Pitch video | _link to be added_ |
| Contracts | [addresses on Monad testnet](#contract-addresses-monad-testnet-10143) |

**The problem.** Community events run quick games to keep a room awake, and the prize is the awkward part: someone checks the answers by hand, someone holds the money, and someone forgets to pay. Quiz tools also only ask what somebody already knows.

**What Kokonad does about it.** The questions are about what is about to happen in the room. Everyone's coin goes into a pot held by a contract, answers stay sealed until time is up, and the contract pays everyone who was right. The host says what happened; the host never touches the pot.

What is live, what exists only in the contracts and what is not built is listed under ["Status at submission"](#status-at-submission-13-oct-2026). The sections before it say which is which.

---

## What it does

Everything in this section runs today on the public site.

**Host**
- Creates a room with a 6-character code; only people with the code can join.
- Funds the room: the host's budget becomes every participant's starting coins, so participants never pay (a **sponsored** room).
- Types the questions, or says in one line what the event is about and gets a first draft from an LLM, editable before use.
- Seals all the questions before the first one opens (hashes on-chain), opens them one at a time with a timer, and sets the result with one click.
- Puts the big screen (`/host/<CODE>/screen`) on a projector: the code and a QR to scan, the live question and clock, the result, the standings.

**Participant**
- Scans the QR or types the code and picks a name. "Just play on this device" needs no sign-in; email or Google sign-in through Dynamic is wired next to it. The words "wallet", "gas" and "transaction" never appear on screen.
- Gets the starting coins on joining (mock ERC-20 `KOKO` on testnet).
- Every question takes one **play** (one coin) from everyone in the room into that question's pot. Answering is one tap; sitting out forfeits the play.
- Answers stay sealed until time is up, then every phone opens its own answer.
- Was right: an equal share of the pot lands in the balance once the 60-second dispute window has passed, with nothing to claim. Was wrong or sat out: the play stays in the pot. So the budget flows from wrong and absent answers to right ones instead of being handed out evenly.

**Designed, in the contracts, not in the app yet:** pooled rooms (everyone puts in the same amount), a host **seed** on a question, nearest-number and exact-guess questions, the "first N correct" rule, a host who plays along, and the participant's call to dispute a result (the contract counts disputes and refunds the pot at one third; the app has no button for it).
**Designed, not built:** host reputation, the end-of-session podium and titles, passkey-derived salts.

---

## How one question works

```
Host opens the question      →  30-second timer
Everyone in the room is charged one play into the pot
Participants answer          →  play burned, hash(answer, salt) stored
Time is up                   →  participant apps reveal automatically; all answers become visible
Host sets the result         →  contract mints a Correct token to each winner
60-second dispute window     →  if ≥ 1/3 of answerers disagree, the pot is refunded (contract; no button in the app yet)
Settle                       →  the pot is split evenly between the winners; coins land in their balances
```

What the contract guarantees:
- Questions are sealed before they open; the host can't change a question after seeing answers.
- Nobody can see anyone else's answer before time is up, including the host and our server.
- Under the "first N correct" rule (in the contract, not offered in the app yet), "fastest" is decided by transaction order in Monad blocks, not by our server.
- The pot is split by the contract, not by the organizers.

What we **don't** claim: millisecond precision (ordering is fair-by-block), and total cheat-proofing (see below).

---

## What if the host cheats?

Kokonad is built for a room: 5 to 50 people watching the same thing happen. At that scale the best oracle is the people in the room, and the most effective sanction is social: nobody joins that host's next session.

The contract isn't a judge, but it makes every trace visible: sealed questions, everyone's answer revealed at the same time, and results and dispute counts recorded permanently. The next step is designed but not built: a host's reputation (sessions run, questions resolved, questions voided by dispute) shown to participants before they join.

---

## Why Monad

1. **Small-transaction economics.** The recorded game below was 23 transactions for 3 players and 2 questions, and cost 0.97 MON in all. By the same count, 10 people × 10 questions is about 300 transactions (seal, answer, reveal, pay-out) moving 1–20 coins each. At $0.05 per transaction that would be $15 in fees, more than the prizes. This product only makes sense on a chain where fees round to zero.
2. **Speed is part of the game.** A room looks at one clock: the laptop, every phone and the big screen each poll the chain every two seconds and draw what they show from a single block. A 30-second question with 15-second confirmations isn't playable. The "first N correct" rule (in the contract, not in the app yet) also only makes sense when ordering is fast and unambiguous.
3. **Our first users are Monad's own community.** The builder is a member of DevWeb3Jogja, an official Metropolis community supporter. The first sessions with people are meant for its events; none has run yet.

**Numbers from one full game on the public site** (room `RN2U3C`, 12 Oct 2026; read from the relayer's ledger and the chain). The players were browsers driven by the end-to-end suite, not people: a session with people is still to come.

| Metric | Value |
|---|---|
| Participants | 3, plus the host and a fourth who was refused (room full) |
| Questions | 2 (one paid out, one cancelled with every play refunded) |
| Total transactions | 23, all on Monad testnet |
| Gas | 0.97 MON, all paid by the relayer; players and host held 0 MON |
| Coins moved | 60 KOKO funded by the host, 3 paid to the winner of question 1, 3 refunded on question 2 |
| Average tap → confirmation | not measured |

The pay-out of question 1: [`0xce900d25…dc68`](https://testnet.monadvision.com/tx/0xce900d25deeca7eb0ee12967981ac994f468a947c2600017abd4d057dbd3dc68). The same game is the footage of the demo video ([`video/`](video/)).

---

## Status at submission (13 Oct 2026)

The sections above describe the product as designed. This is what runs today on https://kokonad.robbyn.xyz and what does not.

**Live**
- Contracts on Monad testnet: `KokoToken`, `RoomFactory`, `Room` with the whole question lifecycle (sealed questions, one play per person into the pot, commit-reveal, result, 60-second dispute window, pay-out, cancel with refunds).
- Relayer (ERC-2771): players and hosts sign, the relayer pays the gas, the contracts credit the signer.
- Web app: host screen, participant screen, and a big screen for the projector (`/host/<CODE>/screen`).
- Sponsored rooms, multiple-choice questions, "everyone right splits the pot".
- First draft of the questions from a one-line brief (any OpenAI-compatible model; MiniMax M2.7 on the public site). The host edits and seals; the host always sets the result.
- Sign-in through Dynamic (email or Google) is wired, next to "Just play on this device", which needs no sign-in. The end-to-end suite and the demo video use the second path; sign-in itself has not been through a full public game yet.

**In the contracts, not in the app yet**
- Pooled rooms, a host seed on a question, nearest-number and exact-guess questions, the "first N correct" rule.
- Disputing a result: the contract enforces the 60-second window and the screens count it down, but the app has no button to disagree yet.

**Not built**
- Envio indexer: screens read the chain directly, one Multicall3 call per poll at a single block.
- WebSocket server: screens poll every two seconds.
- Mera salts: explored in a spike (`/spike`), not in the game. The salt of a sealed answer is random per question and stays on the player's device.
- `HostRegistry` (host reputation), the end-of-session podium and recap, Chainlink CRE.

## Tech stack

| Layer | Technology | Role | Status |
|---|---|---|---|
| Chain | Monad testnet 10143 | source of truth for money, ordering, results | live |
| Contracts | Solidity, Foundry | `KokoToken` (mock ERC-20 standing in for a stablecoin), `RoomFactory`, `Room` (commit-reveal, pot, resolve, dispute, settle) | live; `HostRegistry` not built |
| Gas | ERC-2771 forwarder + relayer (Node, viem) | players sign, the relayer sends and pays; contracts read the signer | live |
| Accounts & signing | **Dynamic** | email/Google sign-in with an embedded account; a guest account per tab as the quick way in | wired; guest path is the tested one |
| Question builder | LLM over an OpenAI-compatible API | first draft of the questions from a one-line brief; the host decides | live |
| Frontend | Next.js, wagmi/viem, Tailwind, motion, three.js | one responsive app: host on laptop, participants on phones, big screen on the projector | live |
| RPC | QuickNode | keyed RPC, not a public endpoint | live |
| Key derivation | **Mera (passkey PRF)** | commit-reveal salt derived from the passkey per question | spike only |
| Data | **Envio HyperIndex** | feed, leaderboard, host stats, session recap | not built |
| Realtime | WebSocket (Node) | synced countdown and animation triggers | not built (polling) |
| Auto-resolver | Chainlink CRE | resolves markets with a public data source | not built (stretch) |

### How it fits together, as built

```
 host laptop · phones · big screen   (one Next.js app)
        │ write: sign an ERC-2771 request in the browser        ▲ read: one Multicall3 call every 2 s,
        ▼                                                       │       every view drawn from a single block
 relayer (Node, viem): verify, dry-run, pay the gas             │
        ▼                                                       │
 Forwarder ──► RoomFactory ──► Room (one per session) + KokoToken        on Monad testnet (10143)
```

Nothing sits between the screens and the chain for reads, and no server decides a winner, an order or an amount.
The relayer also holds the one LLM call (the question draft).

The full design, including the parts not built (indexer, WebSocket, host registry): [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Product spec: [`docs/PRD.md`](docs/PRD.md). Wireframes and mockups: [`docs/`](docs/).

---

## Repo structure

```
contracts/     Foundry: contracts, tests, deploy scripts
backend/       relayer: pays gas for signed player requests, drafts questions (Node, viem)
web/           Next.js app (host, participant, big screen) and the end-to-end suite
video/         the demo video as a Remotion project
deploy/        docker compose and the script that ships the public site
deployments/   contract addresses per chain
design/        the design handoff: mascot poses, logo, landing page
docs/          PRD, architecture, design notes, mockups
```

---

## Contract addresses (Monad testnet 10143)

| Contract | Address |
|---|---|
| Forwarder (ERC-2771) | [`0x2EcC66246C9Bfe144E674231992EE4D0e965F6D4`](https://testnet.monadvision.com/address/0x2EcC66246C9Bfe144E674231992EE4D0e965F6D4) |
| KokoToken | [`0x9Cb56A3d92A8A2b248c5d208DC517f993Dbed930`](https://testnet.monadvision.com/address/0x9Cb56A3d92A8A2b248c5d208DC517f993Dbed930) |
| RoomFactory | [`0x4740943E5395CdC46cD41B5174e0A361A2E97bA9`](https://testnet.monadvision.com/address/0x4740943E5395CdC46cD41B5174e0A361A2E97bA9) |
| HostRegistry | not deployed (not built) |

Rooms are deployed per session by `RoomFactory`; a room's address is `RoomFactory.roomByCode(<CODE>)`.
Addresses live in [`deployments/10143.json`](deployments/10143.json) (deployed 18 Sep 2026 from block 63559698).

### Contracts

`contracts/` holds `KokoToken`, `RoomFactory` and `Room` with the full question lifecycle: join and
deposits (sponsored budget or pooled), sealed questions, one play charged per participant into the pot
with Answer/Correct balances, commit-reveal, resolve, 60-second dispute window, settle (push ≤ 20
winners, pull above), void with refunds, timeout, leave and close. 60 Foundry tests including
`Room.e2e.t.sol`, which replays the PRD §5A worked example to the wei. See
[`contracts/README.md`](contracts/README.md) for the function map and the few places the
implementation deliberately differs from the PRD function table.

### Backend

`backend/` is a relayer. Monad keeps a 10 MON reserve per account, so a fresh player account
cannot pay its own gas. Players and hosts sign requests, and the relayer submits them through an
ERC-2771 forwarder, so the contracts credit the signer. It relays only to Kokonad's own contracts, and
only after the forwarder verifies the signature and a dry run shows the call succeeds. On Monad
testnet, a host and a player each holding 0 MON created, funded and joined a room this way. See
[`backend/README.md`](backend/README.md).

---

## Running locally

```bash
# contracts
cd contracts && forge install && forge test
forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC --broadcast

# backend (relayer): the web app needs it running
cd backend && pnpm install && pnpm test && pnpm test:integration
cp .env.example .env   # RPC_URL, RELAYER_PRIVATE_KEY (wallet holding well over 10 MON), ALLOWED_ORIGIN=http://localhost:3000
pnpm start             # listens on :8787

# web
cd web && pnpm install && cp .env.example .env.local && pnpm dev
```

With the relayer and the web app running: open `/`, "Create room" to host at `/host`, and join from another
browser via "Have a code? Join" (`/join`, then `/r/<CODE>`). Nobody needs MON: every action is signed in the
browser and paid for by the relayer. With "Just play on this device" the account lives in the tab, so a
reload starts a new one; a room can only be hosted from the tab that created it.

Required environment variables are listed in each folder's `.env.example`: RPC URL, relayer key, Dynamic environment ID, LLM API key.

## Trying it as a judge

Live at **https://kokonad.robbyn.xyz** (Monad testnet; the relayer at `kokonad-relay.robbyn.xyz` pays for every step).

1. Open `https://kokonad.robbyn.xyz/host` on a laptop → "Create room" (continue with email, or "Just play on this device").
2. Type the questions, or say what the event is about and take the first draft → "Seal".
3. Click "Open the big screen" in the host sidebar and put that window on the projector: it shows the code and a QR to scan, then the live question, the clock, the result and the standings. It needs no account.
4. Open `https://kokonad.robbyn.xyz/r/<CODE>` on a phone (or another tab) → pick a name → join.
5. On the laptop click "Open question 1"; answer on the phone; when the timer ends, tap the right option on the laptop.
6. Watch the coins land on the phone. The pay-out happens on its own once the result can no longer be disputed.

No wallet, no MON needed: the game token and gas are handled inside the app.

---

## Hackathon-version limitations

- Testnet and mock token only. We demo sponsored rooms (participants never pay: a skill-based prize distribution). Pooled rooms exist in the contracts only; with real money they'd be jurisdiction-gated.
- The host sets results; there is no adjudicated dispute. See "What if the host cheats?".
- Up to 50 participants per room.
- "Fastest" means block order, not milliseconds.

## Roadmap

1. **Now:** event organizers host, questions for the people in the room.
2. **Next:** anyone hosts for their own group: watch parties, classes, office teams. Host reputation becomes a prerequisite; CRE resolves markets that have a data source.
3. **Later:** high-reputation hosts open markets to the public; the reputation is the asset.

---

## Disclosure

- Built with **Claude Code** and other AI tools for code, documents, and design; all product decisions and reviews were made by the team.
- Pre-hackathon code used as **reference** (not shipped as product): a parimutuel `PredictionPool` pattern, ERC-8004 registries, EIP-712 proofs, and a warm design system. Everything demoed was built within the 1 Sep – 13 Oct 2026 window and is visible in the commit history.
- No real token, no wash trading, no fake volume. Any simulated wallets used for load testing are labeled "simulated".
- The coconut mascot and all visual assets are original.
- The demo video shows Monad's logo, taken from Monad's brand kit and used unchanged; it is Monad's trademark and not covered by this repo's licence.

## License

MIT. See [`LICENSE`](LICENSE).

## Team

Solo builder, member of [DevWeb3Jogja](https://web3jogja.com/).
