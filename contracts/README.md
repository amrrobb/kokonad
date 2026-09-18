# Kokonad contracts

Foundry project. Solidity `^0.8.24`, OpenZeppelin v5 via `forge install`, `via_ir` on
(`Room.openQuestion` and the `QuestionOpened` event exceed the legacy stack limit).

| Contract | Role |
|---|---|
| `KokoToken` | Mock ERC-20 standing in for a stablecoin. Anyone can mint. Testnet only. |
| `RoomFactory` | Deploys one `Room` per session, hands out a unique 6-character code, maps code → room. |
| `Room` | Participants and deposits, per-question Answer/Correct balances, sealed questions, pots, commit-reveal, resolve, dispute window, settle, void, close. |

`HostRegistry` is week 2 and is not here yet.

## Commands

```bash
forge install          # first time only, pulls lib/
forge build
forge test             # 51 tests, 0 failures
forge fmt              # before every commit
cp .env.example .env   # fill in RPC + deployer key; never commit .env
forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC --broadcast
```

## Room lifecycle (what the tests cover)

```
join(code, name)        pooled: pulls startingDeposit; sponsored: credits it from the host's budget
commitQuestions(h[])    h = keccak256(abi.encode(text, options, template, rule, n, hostSalt))
openQuestion(...)       verifies the hash, pulls the seed, charges one play from every participant with
                        deposit >= playPrice into the pot, mints Answer_i (AnswerMinted), starts the timer
commitAnswer(id, h)     burns Answer_i (AnswerBurned), h = keccak256(abi.encode(answer, salt))
revealAnswer(id, a, s)  after lockAt, within 90 s; records block and reveal index (on-chain order)
resolve(id, outcome)    host; mints Correct_i to winners (CorrectMinted), opens a 60 s dispute window;
                        nobody right → VOIDED, plays refunded, seed returned
dispute(id)             answerers only; >= 1/3 of answerers → VOIDED, Correct_i burned
settle(id)              anyone, after the window; push for <= 20 winners, else claim(id)
voidByTimeout(id)       anyone, host silent 24 h after lock
leave()                 permanent; refunds the remaining deposit
closeRoom()             host; settles/voids the question in flight, refunds every deposit, returns
                        budget + rounding dust to the host. Unclaimed pull payouts stay claimable.
```

Design notes that differ from the PRD table, on purpose:
- `settle(id)` takes no `orderedWinners`. The contract assigns `revealIndex` sequentially at reveal
  time, so the FASTEST_N order is already on-chain and no off-chain sort needs verifying.
- `topUp` is split by mode: `topUp` (pooled participant), `fundBudget` and `credit` (sponsored host).
- Only one question is in flight at a time. Opening the next one auto-settles a resolved question
  whose dispute window has passed.
- Numeric answers/outcomes (`NEAREST`, `EXACT`) are `int256` values stored in `bytes32`, limited to
  the `int128` range. `CHOICE` answers are the option index as `bytes32`.
- Rounding dust rolls into the next pot; at close it goes to the host.
