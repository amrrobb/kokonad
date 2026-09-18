# Deployments

One JSON file per chain id. Every package (web, indexer, realtime, backend) reads contract
addresses from here; nothing else in the repo hardcodes an address.

| File | Status |
|---|---|
| `10143.json` | **Deployed 18 Sep 2026**, `Forwarder`, `KokoToken` and `RoomFactory` from block 63559698 (the Envio `start_block`). Two earlier deploys are superseded and still on chain: one without the forwarder (block 63545374) and one before the session-key fix (block 63558669). `HostRegistry` is still zero until week 2. |

To deploy (from `contracts/`, with `.env` holding `MONAD_TESTNET_RPC` and `DEPLOYER_PRIVATE_KEY`):

```bash
forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC --broadcast
```

Then copy the printed `KokoToken`, `RoomFactory` addresses and `deployBlock` into `10143.json`
(`deployBlock` is the Envio `start_block`). `HostRegistry` ships in week 2. Rooms are deployed per
session by `RoomFactory` and are not listed here.
