# backend — gas drip

Participants sign in with an embedded account that holds zero testnet MON, and `join()` itself needs
gas, so a contract cannot hand it out. This small Node service does:

- **`POST /drip { address, code }`** sends 0.1 MON once per address, only for a room code the
  `RoomFactory` knows. Call it right after sign-in.
- **`POST /topup { code }`** tops up every participant of that room who is below 0.02 MON back to
  0.1 MON. The host screen calls it before opening a question.
- **`GET /health`**

The drip never touches the pot, results or winners. It only pays for gas (ARCHITECTURE §2).

## Limits

| Limit | Default | Env |
|---|---|---|
| First drip per address | once, ever | ledger file |
| Drip requests per address | 5 / minute | `ADDRESS_REQUESTS_PER_MINUTE` |
| First-time drips per room | 60 / hour | `ROOM_DRIPS_PER_HOUR` |
| Top-up rounds per room | 1 / 10 s | `ROOM_TOPUP_INTERVAL_MS` |
| Total MON sent | 5 / rolling 24 h | `DAILY_CAP_MON` |

## Safety properties

- **Testnet only.** Addresses come from `deployments/<chainId>.json`. The service refuses to start
  on chain 143, on placeholder addresses, or when the RPC's chain ID differs from the file.
- **The ledger fails closed.** It is written atomically (temp file + rename). A torn or malformed
  ledger stops the service instead of being read as empty, which would re-drip everyone.
- **A failed read is not a "no".** If the room lookup fails, the API answers 502, never "unknown room".
- **Sends are serialized** with local nonce tracking, so concurrent sign-ins cannot collide on a
  nonce behind a load-balanced RPC.

## Run

```bash
pnpm install
cp .env.example .env   # RPC_URL and DRIP_OPERATOR_PRIVATE_KEY
pnpm start             # refuses to start until contracts are deployed to 10143
```

## Test

```bash
pnpm test              # 52 unit tests, no chain needed
pnpm test:integration  # 5 tests on a local anvil node with the real compiled contracts (needs Foundry)
pnpm test:all
```

The integration test deploys `KokoToken` and `RoomFactory`, creates a sponsored room, and checks the
real path. A brand-new account with zero balance cannot join. After `/drip` it can join on its own
gas, and the `Joined` event is emitted. It is then refused a second drip. An unknown code gets 404
from the real factory. Five concurrent drips all land. A participant drained below 0.02 MON is
topped up before the next question while the others are untouched.
