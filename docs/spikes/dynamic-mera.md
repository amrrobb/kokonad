# Spike: Dynamic + Mera PRF on one origin

Week 1, day 1–2. Page: `web/app/spike/page.tsx`, route `/spike`. Author: solo builder. Dates: 18 Sep 2026.

## Verdict

**Mera half: proven.** Passkey PRF salt derivation works, is deterministic, is namespaced per question,
and costs exactly one passkey prompt per derivation. Verified headless with Chrome 153 virtual
authenticators (evidence below).

**Dynamic half: NOT TESTED — no sandbox environment ID was available on 18 Sep.** The code path is
built, compiles, and is gated behind `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` so the page builds and the
Mera half works without it. Sign-in, embedded account creation on 10143, delegated access and the
no-popup sample call have not been exercised against a live environment. **Coexistence is therefore
untested**; the honest state is "no evidence either way", not "yes".

**Coexistence: PENDING the Dynamic run.** Expectations before the run (Mera from reading its source; Dynamic from its docs, to be confirmed by the runtime probe):

- Mera is a stateless function library (`@category-labs/mera` 0.2.0, ~1600 LOC, no provider, no
  global state, no iframe). It calls `navigator.credentials.create/get` with `rp.id` set by us.
- Dynamic's embedded wallet is MPC-based; passkeys there are a sign-in / MFA method handled by Dynamic's
  own flow, expected to use Dynamic's relying-party ID rather than ours. If so the two libraries never
  see each other's passkeys and cannot collide on `rpId`. Unverified until the run. The spike page records every `navigator.credentials` call with its
  `rpId` to confirm this at runtime (section 3 of the page).
- No bundle conflict: `pnpm build` passes with both installed (Next 16.3.5, Turbopack). Mera pins
  `@noble/hashes` 2.2.0 and `@noble/curves` 2.2.0; viem 2.56 uses its own copies. No peer warnings.

## What the page does

1. **Sign in and your account** (renders only when `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` is set):
   Dynamic widget for Google / email / passkey sign-in; embedded EVM account created after login
   (dashboard auto-create, with a fallback `createWalletAccount([Evm])`); Monad testnet 10143 added via
   `overrides.evmNetworks`; buttons for *Let the app act for me* (`useWalletDelegation().initDelegationProcess`),
   *Confirm a sample answer* (`signMessage` through the embedded account's viem wallet client) and
   *Send an empty action* (0-value self-transfer on 10143).
2. **Sealed-answer key from your passkey**: namespace `kokonad/room/<CODE>/q/<index>` →
   `prfSalt = sha256(namespace)` → `getPasskeyPrfOutput({ rpId, prfSalt })` → 32-byte PRF output →
   shown as `keccak256(output)`. A "no passkey yet" path uses `createPasskeyWithPrfOutput`. A repeat on
   the same device reports *same key / DIFFERENT key*; a paste box compares with another device.
3. **What happened on this page**: a probe wraps `navigator.credentials.create/get` and lists each
   call with its `rpId`, whether PRF was requested, and the outcome; each action reports how many
   prompts it caused and how long it took.

## Evidence — Mera (headless, Chrome 153 virtual authenticator, `hasPrf: true`, rpId `localhost`)

Harness: Playwright-core driving system Chrome over CDP (`WebAuthn.addVirtualAuthenticator`).
Raw output in `assets/mera-headless-summary.json`.

| Check | Result |
|---|---|
| Create passkey + first key, `q/1` | `0xa424fc4b…759ca8`, 1 prompt, 50 ms |
| Derive again, same device, `q/1` | `0xa424fc4b…759ca8` — **same key**, 1 prompt, 28 ms |
| Derive `q/2` (different namespace) | `0x08d82234…8a0d3` — **different key**, 1 prompt, 27 ms |
| Different passkey (profile C), `q/1` | `0x553ff5ba…d7dd3` — different, paste-compare says *No match* |
| Prompts for 3 derivations | 3 (exactly one per derivation, no fallback second prompt) |
| Relying-party IDs seen | `localhost` only |

Screenshots: `assets/mera-360-profile-a.png` (360 px), `assets/mera-1280-profile-c.png` (1280 px).

**Cross-device reproducibility — needs a human with a synced passkey.** Chrome's virtual authenticator
can export a credential's private key but not its PRF secret, so a credential imported into a second
virtual authenticator answers the assertion and returns no PRF output (`PRF_UNAVAILABLE`, see
`assets/mera-headless-summary.json`, field `reproducedOnSecondProfile`). That is a harness limit, not a
Mera limit; the real proof is the manual procedure below and it is what the bounty asks to see live.

### Manual cross-device procedure (do this once, ~3 minutes)

Passkeys must be synced (iCloud Keychain on Safari/Chrome macOS+iOS, or Google Password Manager on
Chrome with the same Google account). `localhost` passkeys are not synced by iCloud; use a real host.

1. Serve the page on a hostname both browsers resolve, e.g. the VPS behind
   `spike.robbyn.xyz` or an `ngrok`/`cloudflared` tunnel. Set `NEXT_PUBLIC_PASSKEY_RP_ID` to that host.
2. Browser 1: open `/spike`, room `KOKO42`, question `1`, press **I have no passkey here yet**. Complete
   Touch ID / Face ID. Note the fingerprint.
3. Browser 2 (second Chrome profile, or Safari, or the phone): open the same URL, same room and question,
   press **Get this question's key**. Pick the passkey created in step 2 from the platform sheet.
4. Paste the fingerprint from browser 1 into *Paste the fingerprint shown on your other device*. Expected:
   **Match: the other device has the same key.**
5. Change question to `2` on both. Expected: new fingerprints, still matching each other, different from `q/1`.

If step 3 shows *This device's passkey cannot derive a secret*, the platform authenticator lacks PRF
(older Android, Windows Hello without hmac-secret). Record the device and OS; that is the fallback case
(ARCHITECTURE §4: salt in encrypted localStorage + "do not switch phones" warning).

## Evidence — Dynamic

None yet. Run the checklist below as soon as the ID lands; it takes about ten minutes.

### Dynamic checklist for the next session

Prerequisites (user confirmed done in the sandbox on 18 Sep): embedded wallets on with automatic
creation; delegated access enabled; transaction confirmation screen off; EVM chains enabled.

```sh
cd web && echo 'NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=<uuid>' >> .env.local && pnpm dev
```

Open `http://localhost:3000/spike` in Chrome and record, in this order:

| # | Step | Expect | Record in this doc |
|---|---|---|---|
| 1 | Section 1 shows the Dynamic widget, log line `Dynamic loaded` | no console errors, `Loaded: yes` | any console error verbatim |
| 2 | Sign in with **Google** (then repeat the whole list with **passkey** sign-in in a fresh profile) | `Signed in: yes`, `Account: 0x…`, `Account kind: … (embedded)` | address, kind, seconds to account |
| 3 | `Network` row | `Monad testnet (10143)`; if not, `mergeNetworks` in `providers.tsx` is wrong or the chain is off in the dashboard | value shown |
| 4 | Press **Confirm a sample answer** | signature appears, log says `passkey prompts: 0`, and no Dynamic modal opened | prompts count, whether a modal appeared, ms |
| 5 | Press **Send an empty action** | expected failure `insufficient funds` (account has 0 MON) — that still proves the write path reaches the RPC with no popup; with a faucet drip it should return a hash | error text or tx hash |
| 6 | Press **Let the app act for me** | Dynamic's delegation prompt, then `App may act for me: delegated`; if `feature off in dashboard`, delegated access is not enabled for this environment | status after, any error |
| 7 | Section 2: **I have no passkey here yet**, then **Get this question's key** | works exactly as in the headless run, *same key* | fingerprint, prompts |
| 8 | Section 3: `Passkey domains seen` | during passkey sign-in (step 2 variant) note whether Dynamic's ceremonies show up at all in the log and with which `rpId`; Mera's must show `localhost` | list of rpIds and which action produced each |
| 9 | Repeat step 7 **after** step 6 and step 4 | still one prompt per derivation, no extra Dynamic prompt | prompts |

Coexistence verdict rule: **yes** if steps 4, 7 and 9 all hold in both sign-in variants (no extra prompts,
different or absent Dynamic rpId, Mera key unchanged). **no** if any Mera derivation triggers a Dynamic
prompt, Dynamic sign-in breaks after a Mera passkey exists on the origin, or `pnpm build` breaks with both
(already known to pass). If **no**: drop Mera per CLAUDE.md, salt in encrypted localStorage, note in README.

## Recommended integration shape (provisional, to confirm after the Dynamic run)

- Keep exactly what the spike has: `DynamicContextProvider` → `WagmiProvider` → `QueryClientProvider` →
  `DynamicWagmiConnector` in `web/app/providers.tsx`. Monad testnet through `overrides.evmNetworks`.
- Mera stays a pure function module (`web/lib/mera.ts`): `deriveSalt(namespace)` returns the salt bytes
  in memory only. No provider, no context, nothing persisted. Call it at commit and again at reveal.
- The namespace for the real app should include the Room **address**, not the code, so a reused code
  in a later event cannot produce a correlated salt: `kokonad/room/<address>/q/<index>`.
- Dynamic passkeys (if the user chooses passkey sign-in) and the Mera passkey are two different
  credentials on two different relying-party IDs. UX consequence: a passkey-first user gets one extra
  passkey creation the first time they seal an answer. Google/email users get the same extra step.
  This is one prompt per question at commit and one at reveal, which is acceptable for a 6–10 question
  session; auto-reveal without a prompt is not possible with PRF (user verification is mandatory in the
  spec), so **reveal must be a tap**, or the salt is held in memory from commit and reveal runs
  automatically only while the tab stays open.
- No popups for the on-chain calls come from the dashboard toggle (embedded wallet confirmation UI
  off) plus, for auto-reveal from the server, delegated access. Delegated access is a **server-side**
  mechanism: Dynamic posts an encrypted key share and per-wallet API key to a registered HTTPS
  webhook; the backend signs with `@dynamic-labs-wallet/node-evm`. That is a `backend/` component for
  week 2, not a client feature.

## Reproduce

```sh
cd web
cp .env.example .env.local   # fill NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
pnpm install
pnpm dev                     # http://localhost:3000/spike
pnpm build                   # must pass
```

Headless Mera proof (no human needed): the harness lives outside the repo (scratch); it launches system
Chrome with `playwright-core`, adds a CTAP2.1 virtual authenticator with `hasPrf: true`, and drives the
buttons by `data-testid`. Reproduce by copying the steps in the table above.
