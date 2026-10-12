# End-to-end suite

```sh
cd web && pnpm e2e            # everything
pnpm e2e game.spec.ts         # one file
```

Needs Foundry (`anvil`, `forge`) on PATH and `pnpm install` done in `web/` and `backend/`. Takes about four minutes;
most of it is the contract's own clocks (20 s to answer, 60 s dispute window), which the suite waits out for real.

**Hermetic.** Global setup (`stack.ts`) starts a local chain with Monad testnet's chain id, deploys the real compiled
contracts, starts the real relayer against it with a public anvil dev key, then builds and serves this app with those
addresses. Monad testnet is never contacted, `backend/.env` is never read, and the running `pnpm dev` on :3000 is left
alone (the suite builds into `.next-e2e/` and serves on :3101).

**Accounts are automatic.** Each browser context gets the account the app makes for it, the same way a participant
does. The suite never injects a key into a page. Sign-in through Dynamic is switched off for the run, so this suite
does not cover it; that needs its own test once `lib/signer.ts` returns Dynamic's account.

**Screens are checked against the chain.** After every money step the spec reads the contracts directly with viem
and compares: balances, winners, outcome, and that every coin the host funded is accounted for.

| File | Covers |
|---|---|
| `landing.spec.ts` | `/` at 360 and 1280 px: copy, no sideways scroll, both buttons, no request leaves the machine |
| `join.spec.ts` | `/join` code input rules; unknown code → "Room not found." |
| `duel.spec.ts` | two accounts head to head over three rounds: winner takes the pot, an even split, a decider; the next question is not offered until the current one is paid; final standings are zero-sum on the chain |
| `draft.spec.ts` | host asks for a first draft from a one-line brief (the model is a route stub), drops one, seals the rest; exactly the kept ones reach the chain; with no writer configured only the manual form shows |
| `draft-live.spec.ts` | public target only, with `E2E_DRAFT_KEY`: the real model on the deployed site writes a game from a brief, the host drops one and seals the rest on the chain |
| `game.spec.ts` | create room → 3 join → 4th refused in plain words → question with a winner, a loser and a no-show → dispute wait → pay out → a cancelled question with refunds; a non-host tab cannot run the room; plain-language check on every participant screen; the big screen (`/host/<code>/screen`) follows the same game with no account: code and QR, people joining, the live question and clock, the result, then standings equal to the chain; the logo is on every screen and the mascot's pose matches the moment |

Not covered: Dynamic sign-in, Mera salts, the indexer, and anything that only happens on the real network (rate limits,
Monad's 10 MON reserve, load-balanced RPC lag).

## Against the deployed site

```sh
E2E_TARGET=public E2E_VIDEO=1 pnpm e2e duel.spec.ts   # https://kokonad.robbyn.xyz and its relayer, real testnet MON
E2E_TARGET=public E2E_VIDEO=1 pnpm e2e game.spec.ts   # the full game and the big screen, about 1 MON

E2E_TARGET=public E2E_DRAFT_KEY=<DRAFT_BYPASS_TOKEN> pnpm e2e draft-live.spec.ts   # one real model call, one room
```

Nothing is started or built; the suite plays the deployed site the way a judge would. Stop any local relayer
that holds the same key first: two relayers sending from one account race on the nonce.

The sign-in provider allows about ten requests per network address every ten minutes, and one page load makes
several, so only a few page loads. Past that it refuses
its own requests (the browser logs them as CORS errors) and only "Just play on this device" works. The full game
opens seven browsers from one address, so its last check (no console errors) can fail on those lines alone.

## Against real Monad testnet

```sh
# with the relayer running (`pnpm start` in backend/, :8787, ALLOWED_ORIGIN including http://localhost:3101)
E2E_TARGET=testnet pnpm e2e duel.spec.ts
```

Builds a production copy of the app with your `.env.local` (so the Dynamic environment is on) and serves it on
:3101; nothing is stubbed and the real chain is used. With a Dynamic
environment configured, the specs take the "Just play on this device" path, so they exercise the guest account,
not sign-in. Local and testnet runs keep separate state files and may run back to back, never at the same time
against the same relayer. The relayer pays for every
step, about 1.5 MON for the duel (creating a room alone is ~0.44 MON), and Monad keeps 10 MON of the relayer's balance
out of reach, so check its balance first. `landing.spec.ts` asserts hermetic behaviour and is meant for the local target.
