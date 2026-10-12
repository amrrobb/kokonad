# CLAUDE.md — Kokonad

Read this first in every session. Then `docs/PRD.md` (what to build) and `docs/ARCHITECTURE.md` (how the pieces fit). If anything here conflicts with those, PRD wins on product, ARCHITECTURE wins on integration, this file wins on conventions.

## What this is
Live guessing games for community events on Monad testnet (10143). Host writes questions on a laptop; participants answer from phones via room code; the contract splits the pot the moment the host sets the result. Hackathon project (Monad Metropolis, Track 03), solo builder, deadline 13 Oct 2026.

## Non-negotiables
1. **The chain is the only source of truth for money, ordering, and results.** Envio is for reading. WebSocket is cosmetic. Never show a money figure that didn't come from the chain/indexer.
2. **Participants never see crypto vocabulary.** No "wallet", "gas", "transaction", "hash", "sign", "chain" on participant screens. Say "account", "coins", "sealed", "in your balance".
3. **All UI copy, comments, docs, and commit messages in English.**
4. **No feature moves from STRETCH to MVP.** If a task isn't tagged `[MVP]` in the PRD, ask before building it.
5. **Never store game state in browser storage.** localStorage only for display name and the salt fallback, always inside try/catch.
6. **Testnet only.** No mainnet config, no real token, nothing that touches real value.
7. **Economy = deposits, plays, correct tokens (PRD §5A).** Opening a question charges one play from every participant into the pot and mints Answer_i; answering burns it; sitting out forfeits it; `resolve` mints Correct_i; the pot splits among Correct_i holders. No faucet in the product; sponsored rooms credit deposits from the host's budget, pooled rooms take the participant's own.
8. **Everything demoed must be built inside the hackathon window.** Pre-hackathon code may be read for reference, never copied in as product code without saying so in the README.

## Stack & tooling
- Contracts: Solidity `^0.8.24`, Foundry. `forge fmt` before commit. Tests in `contracts/test/`, one file per contract, plus `Room.e2e.t.sol` for the full lifecycle.
- Web: Next.js (app router), TypeScript strict, wagmi v2 + viem, Tailwind. Package manager: `pnpm`. Node 20.
- Indexer: Envio HyperIndex, TypeScript handlers.
- Realtime & backend: Node 20, TypeScript, `ws` (or Socket.IO), viem for the relayer.
- Chain config lives in `deployments/10143.json`; every package reads addresses from there. Never hardcode an address elsewhere.
- Env vars: each package has `.env.example`; never commit `.env*`.

## Repo layout
```
contracts/  indexer/  realtime/  backend/  web/  cre/  deployments/  docs/  video/
```
See ARCHITECTURE §11. Don't add top-level folders without a reason written in the PR/commit.

## Contract conventions
- Enums and structs exactly as in PRD §8.1 (`Template`, `Rule`, `Status`, `Question`, `Participant`, `Answer`). Answer/Correct are internal balances with `AnswerMinted/AnswerBurned/CorrectMinted` events; no separate token contracts. Don't rename.
- Amounts `uint128`, timestamps `uint64`. Pull-payment for > 20 winners. ReentrancyGuard on anything that moves tokens.
- No owner function may withdraw funds. If you think one is needed, stop and ask.
- Hashes: `keccak256(abi.encode(...))`, never `abi.encodePacked` with dynamic types.
- Events for every state transition; Envio depends on them. Changing an event signature means updating `indexer/` in the same commit.
- Gas-heavy loops (sorting, > 50 iterations) are off-chain; the contract verifies, it doesn't compute.

## Frontend conventions
- One responsive app. Routes: `/`, `/r/[code]`, `/host/[code]`, `/host/[code]/screen`.
- Design tokens from PRD §8.2 (light warm theme, coral primary, gold coins, Nunito). Reference `docs/mockup-v2.html` for layout and motion; match it, don't reinvent.
- Participant screen: one screen, one action, primary button at the bottom. Timer, pot bowl, and "X has answered" feed update without user action.
- Motion (rule changed 11 Oct 2026, see `docs/DESIGN.md` §4): motion explains state changes (join, seal, pot, reveal, result); the coin flight stays the only thing that flies and the mascot idles in place (breathes, nods, hops), nothing else loops or celebrates; money digits are never tweened; enter animations only, no exit animations on pressable things; three.js on host screens only, never on `/r/[code]`; everything honours `prefers-reduced-motion`. `motion` for React screens, `three` + `gsap` for the host's 3D pot bowl, CSS keyframes on the landing page; nothing else.
- Brand on every screen (12 Oct 2026, `docs/DESIGN.md` §6): `<Logo>` from `components/brand.tsx`, and `<Mascot mood>` from `components/mascot.tsx` with the pose that fits the moment. Never an `<Image>` of a mascot file directly (the server-rendered landing page is the one exception: it stays free of client script), never a face drawn in code. A screen with nothing to press uses `<Moment>` (`components/ui.tsx`), not a line of text.
- Things you press use the `.ledge` class (they sit on a ledge and go down when pressed).
- The big screen `/host/[code]/screen` is the room's view: no controls, no account, plain language like a participant screen.
- Mobile-first; test at 360px width. Host screens at ≥ 1024px.
- Data flow: chain events → Envio → React Query. WS only triggers refetch/animations.

## Integrations (see ARCHITECTURE for details)
- **Dynamic**: login, embedded wallet, delegated access. Fallback: own session key (`registerSessionKey`).
- **Relayer** (replaced the gas drip, 18 Sep): Monad keeps a 10 MON reserve per account, so players cannot pay gas. They sign ERC-2771 requests; `backend/` relays them through the forwarder in `deployments/10143.json` after verify + dry run. Contracts read `_msgSender()`, never `msg.sender`. Rate-limit per signer, daily gas cap. The relayer wallet must hold well over 10 MON.
- **Mera PRF**: salt derivation only. If it conflicts with Dynamic, remove it cleanly; don't leave dead code.
- **Envio**: schema in ARCHITECTURE §5. Derived fields computed in handlers, not in the UI.
- **CRE**: stretch. Don't scaffold it before week 3.

## Workflow
- Small commits with clear messages (`contracts: add commit-reveal to Room`, `web: participant question screen with mock data`). The commit history is part of the submission.
- Before marking any contract task done: `forge test` green and a one-line note in the PR/commit about what was tested.
- Before marking any UI task done: screenshot at 360px and at 1280px.
- When unsure whether something is in scope, check the PRD tag. When still unsure, ask; don't guess.
- Keep `README.md` accurate as things ship (addresses, live URL, session numbers). Placeholders are `0x…` and `_n_`; replace them, don't delete the rows.

## Weekly targets (PRD §11)
- W1: one question end-to-end on testnet from two browsers.
- W2: 5-person session with no manual intervention.
- W3: no open P0 bugs.
- W4: submit. No new integrations.

## Things to never do
- Add a "discover", categories, or public feed of rooms. Rooms are private, joined by code.
- Let the WebSocket or any server decide winners, order, or amounts.
- Send answer contents anywhere before reveal.
- Use public RPC endpoints in code paths that participants hit.
- Introduce a second wallet provider alongside Dynamic.

## Session handoff (18 Sep 2026)
Project state, week-1 targets, bounty commitments and hackathon rules are in `docs/HANDOFF.md` and
`docs/METROPOLIS-CONTEXT.md`. Read both once at the start of the first build session.
