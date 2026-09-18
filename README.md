# 🥥 Kokonad

**Live guessing games for community events, where the prize pot settles itself.**

Kokonad is a web app for event hosts (meetups, tournaments, watch parties, classes) who want to turn any moment into a live guessing game in 10 seconds. The host writes questions on a laptop, participants answer from their phones via a link and room code, and the moment the host calls the result, the smart contract on Monad splits the pot to whoever earned it. Nobody checks answers by hand, nobody holds anyone else's money, nobody forgets to pay.

If Kahoot is a quiz where the answer is already known, Kokonad is a guess about something that hasn't happened yet, with a pot that actually moves.

> Built for the **Monad Metropolis Hackathon**, Track 03 Social, Attention & Culture. Runs on Monad testnet (chain ID 10143) with a mock token; no real token exists.

---

## What it does

**Host**
- Creates a room with a 6-character code; only people with the code can join.
- Pastes an event schedule or topic and gets suggested questions from an LLM, editable before use.
- Configures each question: answer template (multiple choice, nearest number, exact guess), payout rule (everyone correct splits evenly, or first N correct), timer, and pot.
- Picks a funding mode: **sponsored** (the host's prize budget becomes every participant's starting deposit; participants never pay) or **pooled** (everyone puts in the same amount).
- Every question charges one **play** from everyone in the room into that question's pot; answering uses the play, sitting out forfeits it. The host may add a **seed**. Whoever is right splits the pot the moment the host calls it. So the budget flows from wrong (and absent) answers to right ones instead of being handed out evenly.
- Seals all questions before the event (hashes on-chain), opens them one at a time, sets the result with one click.
- Can play along, with safeguards (see "What if the host cheats?").

**Participant**
- Opens a link or types a code, signs in with Google or a passkey. A wallet is created behind the scenes; the words "wallet", "gas", and "transaction" never appear on screen.
- Gets a starting deposit on joining ("Grab 20 coins" in sponsored rooms, "Put in 20 coins" in pooled ones; mock ERC-20 `KOKO` on testnet).
- Answers with one tap. Answers stay sealed until time is up, then open automatically for everyone.
- Wins: coins land in the balance that second. Loses or sits out: the play stays in the pot. Disagrees with the result: a 60-second dispute button.
- Leaderboard between questions, podium and titles at the end.

---

## How one question works

```
Host opens the question      →  30-second timer
Everyone in the room is charged one play into the pot
Participants answer          →  play burned, hash(answer, salt) stored
Time is up                   →  participant apps reveal automatically; all answers become visible
Host sets the result         →  contract mints a Correct token to each winner and splits the pot
60-second dispute window     →  if ≥ 1/3 of answerers disagree, the pot is refunded
Settle                       →  coins land in winners' balances
```

What the contract guarantees:
- Questions are sealed before they open; the host can't change a question after seeing answers.
- Nobody can see anyone else's answer before time is up, including the host and our server.
- "Fastest" is decided by transaction order in Monad blocks, not by our server.
- The pot is split by the contract, not by the organizers.

What we **don't** claim: millisecond precision (ordering is fair-by-block), and total cheat-proofing (see below).

---

## What if the host cheats?

Kokonad is built for a room: 5 to 50 people watching the same thing happen. At that scale the best oracle is the people in the room, and the most effective sanction is social: nobody joins that host's next session.

The contract isn't a judge, but it makes every trace visible: sealed questions, everyone's answer (including the host's) revealed at the same time, results and dispute counts recorded permanently, and the host's reputation (sessions run, questions resolved, questions voided by dispute) shown to participants before they put coins in.

---

## Why Monad

1. **Small-transaction economics.** One session of 10 people × 10 questions produces ~300 transactions (answer, reveal, claim) worth 1–20 coins each. At $0.05 per transaction that's $15 in fees, more than the prizes. This product only makes sense on a chain where fees round to zero.
2. **Speed is part of the game.** The "first N correct" rule is only fair when blocks are fast and ordering is unambiguous. A 30-second timer with 15-second confirmations isn't playable.
3. **Our first users are Monad's own community.** We're members of DevWeb3Jogja, an official Metropolis community supporter. Kokonad's first sessions run at its events.

**Numbers from a real session** (filled in after the tester session, pulled from the indexer, not hand-counted):

| Metric | Value |
|---|---|
| Participants | _n_ |
| Questions | _n_ |
| Total transactions | _n_ |
| Average tap → confirmation | _x_ s |
| Coins moved | _n_ |

---

## Tech stack

| Layer | Technology | Role |
|---|---|---|
| Chain | Monad testnet 10143 | source of truth for money, ordering, results |
| Contracts | Solidity, Foundry | `KokoToken` (mock ERC-20 standing in for a stablecoin), `RoomFactory`, `Room` (commit-reveal, pot, resolve, dispute, settle), `HostRegistry` (reputation) |
| Accounts & signing | **Dynamic** | social/passkey login, embedded wallet, delegated access so answering and revealing need no popups |
| Key derivation | **Mera (passkey PRF)** | commit-reveal salt derived from the passkey per question; reveal works from another device, salt is never stored anywhere |
| Data | **Envio HyperIndex** | everything the screens read: feed, distribution, leaderboard, host stats, session recap |
| Realtime | WebSocket (Node) | synced countdown, feed, animation triggers; never decides money or results |
| Question builder | LLM (KIMI / Claude) | suggested questions from free text; the host decides |
| Auto-resolver | Chainlink CRE (stretch) | resolves markets with a public data source, e.g. score guessing |
| Frontend | Next.js, wagmi/viem | one responsive app: host on laptop, participants on phones |
| RPC | Quicknode / Chainstack | sponsored RPC, not public endpoints |

Full architecture and component boundaries: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Product spec: [`docs/PRD.md`](docs/PRD.md). Wireframes and mockups: [`docs/`](docs/).

---

## Repo structure

```
contracts/     Foundry: contracts, tests, deploy scripts
indexer/       Envio: config.yaml, schema.graphql, handlers
realtime/      WebSocket server
backend/       gas drip for new accounts (Node, viem)
web/           Next.js app (host + participant)
cre/           Chainlink CRE workflow (stretch)
deployments/   contract addresses per chain
docs/          PRD, architecture, wireframes, mockups
```

---

## Contract addresses (Monad testnet 10143)

| Contract | Address |
|---|---|
| Forwarder (ERC-2771) | [`0x0Bd2c46bF04a8CC797cAb5587de4DE68dC41BF93`](https://testnet.monadvision.com/address/0x0Bd2c46bF04a8CC797cAb5587de4DE68dC41BF93) |
| KokoToken | [`0x2165526fce349F238B546aEdEcbe74a0F941a3a9`](https://testnet.monadvision.com/address/0x2165526fce349F238B546aEdEcbe74a0F941a3a9) |
| RoomFactory | [`0xCA3cC7361ef62D69d9e6a344B492A176DA23BeD4`](https://testnet.monadvision.com/address/0xCA3cC7361ef62D69d9e6a344B492A176DA23BeD4) |
| HostRegistry | `0x…` |

Rooms are deployed per session by `RoomFactory`; each address is shown on the host screen and in the indexer.
Addresses live in [`deployments/10143.json`](deployments/10143.json) (deployed 18 Sep 2026 from block 63558669; `HostRegistry` ships in week 2).

### Contracts status (week 1)

`contracts/` holds `KokoToken`, `RoomFactory` and `Room` with the full question lifecycle: join and
deposits (sponsored budget or pooled), sealed questions, one play charged per participant into the pot
with Answer/Correct balances, commit-reveal, resolve, 60-second dispute window, settle (push ≤ 20
winners, pull above), void with refunds, timeout, leave and close. 51 Foundry tests including
`Room.e2e.t.sol`, which replays the PRD §5A worked example to the wei. See
[`contracts/README.md`](contracts/README.md) for the function map and the few places the
implementation deliberately differs from the PRD function table.

### Backend status (week 1)

`backend/` holds the gas drip: 0.1 MON once per address for a known room code, top-up below 0.02 MON
before each question, limits per address, per room and per day. 53 unit tests and 6 integration tests
on a local anvil node with the real contracts, where a zero-balance account is dripped and then joins
a room on its own gas. It will not start until the contracts are deployed to 10143. See
[`backend/README.md`](backend/README.md).

---

## Running locally

```bash
# contracts
cd contracts && forge install && forge test
forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC --broadcast

# indexer
cd indexer && pnpm install && pnpm dev

# backend (gas drip)
cd backend && pnpm install && pnpm test && pnpm test:integration

# realtime
cd realtime && pnpm install && pnpm dev

# web
cd web && pnpm install && cp .env.example .env.local && pnpm dev
```

Required environment variables are listed in each folder's `.env.example`: RPC URL, Dynamic environment ID, Envio endpoint, WebSocket endpoint, LLM API key.

## Trying it as a judge

1. Open `https://<live-url>` on a laptop → "Create room" → sign in with Google.
2. Paste any text into the schedule box → "Suggest questions" → "Seal all".
3. Open `https://<live-url>/r/<CODE>` on a phone (or another tab) → sign in → "Grab 20 coins".
4. On the laptop click "Open question 1"; answer on the phone; wait for the timer; on the laptop click the correct option.
5. Watch coins land on the phone, and the transaction counter on the host panel.

No wallet, no MON needed: the mock token and gas are handled inside the app.

---

## Hackathon-version limitations

- Testnet and mock token only. We demo sponsored rooms (participants never pay: a skill-based prize distribution). Pooled rooms work on testnet with worthless coins; with real money they'd be jurisdiction-gated.
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

## License

MIT. See [`LICENSE`](LICENSE).

## Team

Solo builder, member of [DevWeb3Jogja](https://web3jogja.com/).
