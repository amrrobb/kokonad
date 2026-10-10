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
| `game.spec.ts` | create room → 3 join → 4th refused in plain words → question with a winner, a loser and a no-show → dispute wait → pay out → a cancelled question with refunds; a non-host tab cannot run the room; plain-language check on every participant screen |

Not covered: Dynamic sign-in, Mera salts, the indexer, and anything that only happens on the real network (rate limits,
Monad's 10 MON reserve, load-balanced RPC lag).

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
