# Session handoff — Kokonad (18 Sep 2026)

Read after `CLAUDE.md`. This is the state of the project at the moment work moved from the
brainstorm/design sessions (Claude Desktop + Claude Design) into this repo. Delete this file once
week 1 is done; `CLAUDE.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md` stay the source of truth.

## Where things stand
- **No code exists yet.** Everything in this repo is docs and design assets. Build starts now.
- Product, economics (PRD §5A, 17 Sep revision), design system, landing, mascot, recap templates
  are **approved**. Do not reopen them.
- Hackathon: Monad Metropolis, **Track 03 Social, Attention & Culture**. Rules, rubric, every
  bounty, and prior-art notes are in `docs/METROPOLIS-CONTEXT.md`. Deadline **13 Oct 23:59 ET
  (14 Oct 10:59 WIB)**. Registration on the portal closes **6 Oct**.
- Team: solo. Community: **DevWeb3Jogja** (official Metropolis community supporter → eligible
  for the $5K "Best Community Team Project" bounty; confirm the group appears in the profile
  dropdown on hackathon.monad.xyz and select it).

## What is in this repo
```
CLAUDE.md                 conventions (17 Sep version) — read first
README.md                 submission README, placeholders 0x… and _n_ to fill as things ship
LICENSE                   MIT
docs/PRD.md               what to build, [MVP]/[STRETCH]/[OUT] tags, §5A economics, §11 plan
docs/ARCHITECTURE.md      component boundaries, Envio schema, sponsor integrations
docs/DESIGN.md            tokens, components, motion — implement, don't invent
docs/screens.html         all participant/host states (source of truth for screens)
docs/mockup-v2.html       interactive flow reference
docs/CLAUDE_DESIGN_PROMPTS.md
docs/CHANGES-2026-09-17.md  economics change log; lists copy that must change in mockups
docs/METROPOLIS-CONTEXT.md  hackathon rules, rubric, bounties, prior projects, idea filter
docs/reference/           AI concept art (direction only; text is Indonesian, ignore it)
docs/assets/              logo source, one concept image
design/handoff/           approved landing.html + mascot/icons/recap PNGs; see its HANDOFF.md
                          for exact destination paths under web/
```

## Bounties committed (all must be real product features, not add-ons)
| Bounty | Where in Kokonad | Week |
|---|---|---|
| Dynamic ($5K) | social/passkey login, embedded wallet, **delegated access** so answer+reveal need no popups | 1 (coexistence test), 2 (wire) |
| Mera PRF ($2.5K) | commit-reveal salt per question derived from passkey; reveal from a second device live | 1 (test), 2 |
| Envio ($1K) | every screen reads from HyperIndex; derived entities (SessionStats, Host reputation) | 2 |
| Community Team ($5K) | DevWeb3Jogja in profile | now |
| KIMI (credits) | question builder LLM; blog post only if time in week 4 | 2 |
| Chainlink CRE ($3K) | auto-resolver, **stretch, not before week 3** | 3 |

Verified facts: Envio supports Monad testnet (`network id 10143`); CRE lists Monad testnet
(CLI v1.30.0+, SDK v1.19.0+); Dynamic is in Monad's embedded-wallet docs; Mera PRF API is
`createPasskeyWithPrfOutput` / `getPasskeyPrfOutput`, salts are namespaces, rpId is domain-bound.
**Unverified:** Mera PRF running alongside Dynamic on the same origin — this is the day-1 test.

## Week 1 targets (16–22 Sep, from PRD §11)
Definition of done: **one question playable end-to-end on Monad testnet from two browsers.**

1. Scaffold `contracts/` (Foundry): `KokoToken`, `Room` (commit / reveal / resolve / settle),
   `RoomFactory`; tests per contract + `Room.e2e.t.sol`. Deploy to 10143, write
   `deployments/10143.json`.
2. Day 1–2 spike: Dynamic embedded wallet + delegated access **and** Mera PRF on one page.
   If they conflict, drop Mera cleanly (CLAUDE.md says so) and note it in README.
3. ~~`backend/drip`~~ **Replaced 18 Sep by a relayer** (Monad 10 MON reserve; see ARCHITECTURE §2). Original: 0.1 MON once per address, top-up below 0.02 before each question,
   rate-limited per address and room.
4. `web/`: participant question screen with mock data first (match `docs/screens.html` at 360px),
   then basic host screen. Landing from `design/handoff/landing.html` → `web/app/(marketing)/page.tsx`.
5. Community: confirm DevWeb3Jogja in portal profile; **lock two tester dates**
   (session 1 week 2: 3–5 people; session 2 week 4: ≥ 8 people, recorded).
6. Portal: create the project (name Kokonad), pick Track 03, attach bounties above.

## Rules that bite (short version; full text in METROPOLIS-CONTEXT §2)
- Repo public, MIT, commit history covers the window → **commit small and often from day 1**.
- README must disclose AI tools and identify pre-hackathon reference code (already drafted).
- No third-party IP, testnet only, no real token.
- Simulated wallets for load tests are labeled "simulated", never counted as users.
- Never paste private keys into any chat. Deployer key lives in `contracts/.env` (gitignored).

## Open decisions (PRD §14) — defaults apply until changed
1. Deposit 20, play price 1 sponsored / 2 pooled.
2. `EXACT` = numbers only in MVP.
3. Display name = free text.
4. Domain placeholder `kokonad.xyz`.

## Not yet done from the design handoff
- Copy changes listed in `docs/CHANGES-2026-09-17.md` have **not** been applied to
  `docs/screens.html` / `docs/mockup-v2.html`. Apply them when those screens are first built.
- ~~Git repo has no commits~~ — done: baseline and handoff docs are committed and pushed.

---

## Coordinator handoff (18 Sep 2026, 09:30 WIB)

Written by the previous coordinator session (which lived in the ETHGlobal folder; this repo now
has its own Orca project "Metropolis"). Nothing below is in the PRD; keep it until week 1 is done.

### What happened
- Repo created and pushed: **https://github.com/amrrobb/kokonad** (public, MIT, `main`, 1 commit).
  Decision: stay on the personal account; transfer to an org later takes a minute and redirects.
- **18 Sep: repo switched to PRIVATE** at the user's request (no org for a single repo). It **must be made
  public again before submission** (13 Oct): the rules require a public repo, and the portal needs
  `metropolis@hackathon.monad.xyz` as a collaborator. `gh repo edit amrrobb/kokonad --visibility public
  --accept-visibility-change-consequences`.
- First orchestration attempt (`run_a147345ce7e1`, tasks `task_903456d7ad6d` A and
  `task_e585dc8882d3` B) died ~30 s after start, most likely an Orca restart ("Update installed ·
  Restart to update"). Both dispatches were abandoned. **Nothing was written to disk; start clean.**
- Reusable specs for A and B: `docs/orchestration/week1-tasks.md`. Run them as two supervised
  Claude workers in the current worktree, disjoint ownership (`contracts/**` vs `web/**`).

### Inputs the coordinator must get from the user
- **Dynamic environment ID** (sandbox) from app.dynamic.xyz. Task B will `ask` for it; relay it,
  never invent one. Put it in `web/.env.local` (gitignored), document the var in `web/.env.example`.
- No deployer key exists yet. Task A must not deploy; `deployments/10143.json` stays placeholder.
  When the user provides a testnet key it goes in `contracts/.env` only. Never paste keys in chat.

### Guardrails learned this session
- Do not resume or reuse any Claude session that carries Napier (employer) context in this repo;
  the repo is public. Always start `claude` fresh here.
- Workers must `git add <paths>`, never `-A`; `git pull --rebase origin main` before push.
- Commits carry no AI attribution / Co-Authored-By lines (user rule overrides tool defaults).
- Simulated wallets are labeled "simulated" everywhere; only real people count as testers.

### Portal checklist (user-side, not done yet)
- Create project "Kokonad" on hackathon.monad.xyz, Track 03, repo URL above.
- Attach bounties: Dynamic, Mera PRF, Envio, Best Community Team (select **DevWeb3Jogja** in
  profile), KIMI. CRE only if week 3 is safe.
- Add `metropolis@hackathon.monad.xyz` as a collaborator.
- Lock two tester dates with DevWeb3Jogja (week 2: 3–5 people; week 4: ≥ 8, recorded).
- Registration closes 6 Oct; submissions open 22 Sep; deadline 14 Oct 10:59 WIB.
