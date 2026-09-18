# backend — relayer

Monad keeps a **10 MON reserve** per account. Measured on testnet (18 Sep 2026): an account holding
0.1 to 1 MON could not send any ordinary transaction, even 11 minutes after it was funded. So players
cannot pay their own gas, and a small gas drip does not help.

Instead, players and hosts **sign** requests and this service **relays** them through OpenZeppelin's
`ERC2771Forwarder`. The contracts read the signer via `_msgSender()`, so the signer is credited, never
the relayer. A player's account only ever signs; it needs no MON at all.

- **`POST /relay { request }`** submits one signed request. The `request` fields are `from`, `to`,
  `value`, `gas`, `deadline`, `data` and `signature`, with integers as decimal strings.
  `src/request.ts` builds and signs one with viem.
- **`GET /health`**

## What the relayer checks before paying

1. **Value** must be 0, **gas** at most 8,000,000, and the **deadline** in the next 24 hours.
2. **Target** must be `KokoToken`, `RoomFactory`, or a room that `RoomFactory.roomByCode` maps back
   to that exact address. Any other contract is refused.
3. **Signature, nonce and deadline** are checked by the forwarder's own `verify`.
4. **Dry run.** The call is simulated as the signer. A call that would revert is refused with the
   contract's reason, such as `AlreadyJoined`, before any gas is spent.
5. **Limits** allow 30 requests per signer per minute and 5 MON of gas per rolling 24 hours.

The relayer can delay a request. It cannot forge or alter one, and it never decides money or results.

## Cost and funding

Measured on testnet:

| Relayed action | Gas paid |
|---|---|
| Create a room | about 0.44 MON |
| Mint, approve, fund, join | 0.01 to 0.03 MON each |

A 10-player session with about 10 questions costs roughly 5 MON. The relayer wallet must also keep
its own 10 MON reserve, so fund it well above 10 MON. It warns at startup when it holds less.

## Safety properties

- **Testnet only.** Addresses come from `deployments/<chainId>.json`. The service refuses to start
  on chain 143, on any zero address, or when the RPC's chain ID differs from the file.
- **The spend ledger fails closed.** It is written atomically, with a temp file and a rename. A torn
  or malformed ledger stops the service instead of resetting the daily cap.
- **A failed read is not a verdict.** RPC failures answer 502, never "refused".
- **Sends are serialized** with local nonce tracking, so concurrent relays cannot collide.

## Run

```bash
pnpm install
cp .env.example .env   # RPC_URL and RELAYER_PRIVATE_KEY (wallet holding well over 10 MON)
pnpm start
```

## Test

```bash
pnpm test              # unit tests with a fake chain, no key needed
pnpm test:integration  # anvil + the real compiled contracts and forwarder (needs Foundry)
```

The integration test runs the real contracts behind the real forwarder. A host holding zero MON
creates a room, mints, approves and funds it, all through signed requests. A player holding zero
MON joins and is credited as themselves. Forged, replayed, reverting and off-target requests are
refused.

The same flow was run on Monad testnet against the live deployment on 18 Sep 2026. Both accounts
ended holding 0 MON.
