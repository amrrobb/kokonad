# Week 1 orchestration task specs

Reusable specs for `orca orchestration worker-start --spec "<text>" --worktree current --agent claude --json`.
Both workers run in the same checkout with disjoint ownership (`contracts/**` vs `web/**`).
Run from a coordinator terminal inside the Metropolis (monad-metropolis) project.

```text
orca orchestration run-create --objective "Kokonad week 1: contracts scaffold + Dynamic/Mera spike (docs/HANDOFF.md)" --json
orca orchestration worker-start --spec "<Task A>" --task-title "A: Foundry contracts scaffold" --worktree current --agent claude --json
orca orchestration worker-start --spec "<Task B>" --task-title "B: Dynamic+Mera PRF spike" --worktree current --agent claude --json
orca orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 900000 --json
```

## Task A — Foundry contracts scaffold

```text
Kokonad — Task A: Foundry contracts scaffold (week 1).
Read first: CLAUDE.md, docs/HANDOFF.md, docs/PRD.md §5A §6 §8.1, docs/ARCHITECTURE.md.
TARGET: contracts/ (new Foundry project) and deployments/ only.
CHANGE: implement KokoToken (mock ERC-20 standing in for a stablecoin), Room (join/deposit, sealQuestions with hashes, openQuestion charging one play per participant into the pot + Answer balance, commit(hash), reveal, resolve minting Correct balances and splitting the pot, dispute window, settle, void/refund, leave), RoomFactory. Enums/structs/events exactly as PRD §8.1 (Template, Rule, Status, Question, Participant, Answer; AnswerMinted/AnswerBurned/CorrectMinted events). Amounts uint128, timestamps uint64, ReentrancyGuard on token moves, no owner withdraw, keccak256(abi.encode(...)), events on every state transition, no loops > 50 on-chain. Tests: one file per contract plus Room.e2e.t.sol covering the full lifecycle of one question with 3 participants (one correct, one wrong, one sat out) and the PRD §5A worked example numbers. Add script/Deploy.s.sol targeting Monad testnet 10143 reading RPC/key from env; do NOT deploy (no key available) — leave deployments/10143.json with placeholder addresses and a README note. HostRegistry is week 2: do not build it.
CONSTRAINTS: Solidity ^0.8.24, OpenZeppelin via forge install, forge fmt before every commit. Testnet only. Never commit .env. No AI attribution or Co-Authored-By lines in commits (user rule). All code/comments/commits in English.
OWNERSHIP: you may create/edit only contracts/**, deployments/**, and add a contracts section to README.md. Another worker is editing web/** concurrently in the same checkout — never touch web/, never run git add -A; stage only your paths. Before each push: git pull --rebase origin main.
ACCEPTANCE: forge build and forge test pass with 0 failures; paste the forge test summary line in worker_done; commits pushed to origin main; list files modified.
```

## Task B — Dynamic + Mera PRF coexistence spike

```text
Kokonad — Task B: Dynamic + Mera PRF coexistence spike (week 1, day 1–2).
Read first: CLAUDE.md, docs/HANDOFF.md, docs/ARCHITECTURE.md (Identity section), docs/METROPOLIS-CONTEXT.md §5.1 (Dynamic and Mera bounty criteria).
TARGET: web/ (new Next.js app-router project, TypeScript strict, Tailwind, pnpm, wagmi v2 + viem, Node 20) and docs/spikes/.
CHANGE: scaffold web/ and build ONE page /spike that (1) signs the user in with Dynamic (social/passkey), creates an embedded wallet on Monad testnet 10143, and enables delegated access so a sample contract call (e.g. a signed message or a no-op tx) needs no popup; (2) derives a 32-byte salt with Mera passkey PRF (getPasskeyPrfOutput / createPasskeyWithPrfOutput, docs at mera.category.xyz) under the namespace "kokonad/room/<code>/q/<index>", displays its keccak, and proves cross-device reproducibility by showing the same value in a second browser profile; (3) reports whether the two libraries coexist on one origin (rpId/domain conflicts, double passkey prompts, bundle issues). Write docs/spikes/dynamic-mera.md with: verdict (coexist yes/no), exact steps to reproduce, screenshots or console evidence, and the recommended integration shape for the real app. Do not build participant/host screens or the landing; do not add a second wallet provider.
CONSTRAINTS: Dynamic environment ID and any API keys come from the user — if not present in web/.env.local, use the preamble ask command to request them from the coordinator (do not invent, do not hardcode). Provide web/.env.example. Never commit .env*. No crypto vocabulary in UI copy. No AI attribution or Co-Authored-By lines in commits. English everywhere.
OWNERSHIP: you may create/edit only web/** and docs/spikes/**. Another worker is editing contracts/** concurrently in the same checkout — never touch contracts/, never run git add -A; stage only your paths. Before each push: git pull --rebase origin main.
ACCEPTANCE: pnpm build passes; /spike works in pnpm dev; docs/spikes/dynamic-mera.md exists with a clear verdict; commits pushed to origin main. If the verdict is "no", say so explicitly in worker_done with --outcome succeeded (a negative but proven result is success).
```
