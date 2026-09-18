# Spike: Dynamic + Mera PRF on one origin

Week 1, day 1–2. Page: `web/app/spike/page.tsx`, route `/spike`. Author: solo builder. Dates: 18 Sep 2026.

## Verdict

**Mera half: proven.** Passkey PRF salt derivation works, is deterministic, is namespaced per question,
and costs exactly one passkey prompt per derivation. Verified headless with Chrome 153 virtual
authenticators (evidence below).

**Dynamic half: PENDING the sandbox environment ID.** The code path is built and compiles, but sign-in,
embedded account creation on 10143, delegated access and the no-popup sample call have not been
exercised against a live environment yet. This section is updated the moment the ID is available.

**Coexistence: PENDING the Dynamic run.** What is already known from reading both SDKs:

- Mera is a stateless function library (`@category-labs/mera` 0.2.0, ~1600 LOC, no provider, no
  global state, no iframe). It calls `navigator.credentials.create/get` with `rp.id` set by us.
- Dynamic's passkey-based embedded wallet runs its WebAuthn ceremonies from its own relay iframe
  (`relay.dynamicauth.com`), so its passkeys are bound to Dynamic's relying-party ID, not ours, unless
  a custom domain is configured. That means the two libraries should not see each other's passkeys
  and cannot collide on `rpId`. The spike page records every `navigator.credentials` call with its
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

_Pending environment ID. To be filled: sign-in method used, account address, network reported by the
wallet client, delegation status, whether the sample confirm and the empty action showed any prompt,
number of `navigator.credentials` calls and their `rpId` during sign-in._

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
