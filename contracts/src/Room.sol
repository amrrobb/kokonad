// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title Room
/// @notice One live guessing session. Holds participants' deposits, per-question Answer/Correct balances,
///         sealed questions, pots, commit-reveal, resolution, dispute window, settlement and voids.
/// @dev Economics follow PRD §5A: opening a question charges one play from every participant with enough
///      deposit into that question's pot and mints Answer_i; answering burns Answer_i; sitting out forfeits
///      the play; `resolve` mints Correct_i; the pot splits evenly among Correct_i holders after the dispute
///      window. Rounding dust rolls into the next pot and goes to the host at close.
///      The chain is the only source of truth for money, ordering and results. No function lets anyone
///      withdraw funds that are not theirs.
contract Room is ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------------------------------
    // Types (PRD §8.1 — do not rename)
    // ---------------------------------------------------------------------------------------------

    enum Template {
        CHOICE,
        NEAREST,
        EXACT
    }

    enum Rule {
        SPLIT,
        FASTEST_N
    }

    enum Status {
        DRAFT,
        OPEN,
        LOCKED,
        REVEAL,
        RESOLVED,
        SETTLED,
        VOIDED
    }

    struct Question {
        bytes32 commitHash; // keccak256(abi.encode(text, options, template, rule, n, hostSalt))
        string text; // filled at OPEN
        string[] options; // for CHOICE
        Template template;
        Rule rule;
        uint8 n; // for FASTEST_N
        uint128 hostSeed;
        uint128 pot; // playPrice × charged + hostSeed (+ dust carried from the previous question)
        uint32 charged; // participants who received Answer_i
        uint64 openAt;
        uint64 lockAt;
        uint64 revealUntil;
        uint64 disputeUntil;
        Status status;
        bytes32 outcome; // normalized outcome
        address resolver; // host by default; external resolver for flagged questions (stretch)
        uint32 answerers;
        uint32 revealed;
        uint32 disputes;
    }

    struct Participant {
        uint128 deposit;
        bool left;
        uint32 correctTotal;
    }

    struct Answer {
        bytes32 commitHash; // keccak256(abi.encode(answer, salt))
        bytes32 answer; // filled at reveal
        uint64 revealBlock;
        uint32 revealIndex; // position in this question's reveal order (tx order on chain)
        bool revealed;
        bool claimed;
    }

    /// @notice Room parameters fixed at creation.
    struct Config {
        address token; // ERC-20 used as coins (KokoToken on testnet)
        uint128 playPrice; // charged per participant per opened question
        uint128 startingDeposit; // credited (sponsored) or pulled (pooled) on join
        bool sponsored; // true: host budget funds deposits; false: participants deposit their own
        bool hostPlays; // true: host may join and answer like a participant
    }

    // ---------------------------------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------------------------------

    uint256 public constant MAX_PARTICIPANTS = 50;
    uint256 public constant MAX_QUESTIONS = 50;
    uint256 public constant PUSH_LIMIT = 20; // push payouts up to this many winners, else pull
    uint256 public constant MAX_OPTIONS = 6;
    uint64 public constant REVEAL_WINDOW = 90; // seconds after lock
    uint64 public constant DISPUTE_WINDOW = 60; // seconds after resolve
    uint64 public constant HOST_TIMEOUT = 24 hours; // after lock, anyone may void a silent host
    uint32 public constant MIN_TIMER = 5;
    uint32 public constant MAX_TIMER = 600;

    // ---------------------------------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------------------------------

    address public immutable factory;
    address public immutable host;
    IERC20 public immutable token;
    uint128 public immutable playPrice;
    uint128 public immutable startingDeposit;
    bool public immutable sponsored;
    bool public immutable hostPlays;
    string public code;

    /// @notice Sponsored mode: host budget not yet credited to any participant.
    uint128 public budget;
    /// @notice Rounding dust waiting for the next pot (or the host at close).
    uint128 public dust;
    bool public closed;
    bool public hasActive;
    uint256 public activeQuestion;

    Question[] internal _questions;
    address[] internal _participantList;
    mapping(address => Participant) public participants;
    mapping(address => bool) public joined; // ever joined (leave is permanent)
    mapping(address => string) public displayNames;
    mapping(uint256 => mapping(address => bool)) public hasAnswerToken; // Answer_i minted and not yet burned
    mapping(uint256 => mapping(address => bool)) public hasCorrectToken; // Correct_i
    mapping(uint256 => mapping(address => bool)) public wasCharged; // received Answer_i at open
    mapping(uint256 => mapping(address => bool)) public hasDisputed;
    mapping(uint256 => mapping(address => uint128)) public claimable;
    mapping(uint256 => mapping(address => Answer)) internal _answers;
    mapping(uint256 => address[]) internal _revealers; // reveal order
    mapping(uint256 => address[]) internal _winners;
    mapping(address => address) public sessionKeyOwner; // session key → participant
    mapping(address => uint64) public sessionKeyExpiry; // session key → expiry

    // ---------------------------------------------------------------------------------------------
    // Events (Envio indexes these; changing a signature means updating indexer/ in the same commit)
    // ---------------------------------------------------------------------------------------------

    event Joined(address indexed participant, string displayName, uint128 deposit);
    event Left(address indexed participant, uint128 refunded);
    event Deposited(address indexed participant, uint128 amount, bool fromBudget);
    event BudgetFunded(address indexed host, uint128 amount);
    event SessionKeyRegistered(address indexed participant, address indexed key, uint64 expiry);
    event QuestionCommitted(uint256 indexed id, bytes32 commitHash);
    event QuestionOpened(
        uint256 indexed id,
        string text,
        string[] options,
        Template template,
        Rule rule,
        uint8 n,
        uint128 hostSeed,
        uint128 pot,
        uint32 charged,
        uint64 lockAt,
        uint64 revealUntil
    );
    event AnswerMinted(uint256 indexed id, address indexed participant, uint128 play);
    event AnswerBurned(uint256 indexed id, address indexed participant);
    event AnswerCommitted(uint256 indexed id, address indexed participant, bytes32 commitHash);
    event QuestionLocked(uint256 indexed id, uint64 lockAt);
    event AnswerRevealed(uint256 indexed id, address indexed participant, bytes32 answer, uint64 block_, uint32 index);
    event CorrectMinted(uint256 indexed id, address indexed participant);
    event CorrectBurned(uint256 indexed id, address indexed participant);
    event Resolved(uint256 indexed id, bytes32 outcome, uint32 winners, uint64 disputeUntil);
    event Disputed(uint256 indexed id, address indexed participant, uint32 disputes);
    event Voided(uint256 indexed id, string reason);
    event Settled(uint256 indexed id, uint128 paid, uint32 winners, bool pushed);
    event Claimable(uint256 indexed id, address indexed winner, uint128 amount);
    event Claimed(uint256 indexed id, address indexed winner, uint128 amount);
    event SeedReturned(uint256 indexed id, uint128 amount);
    event Refunded(address indexed participant, uint128 amount);
    event RoomClosed(uint128 refunded, uint128 returnedToHost);

    // ---------------------------------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------------------------------

    error NotHost();
    error NotResolver();
    error NotParticipant();
    error RoomIsClosed();
    error WrongCode();
    error HostCannotJoin();
    error AlreadyJoined();
    error RoomFull();
    error InsufficientBudget();
    error ZeroAmount();
    error PooledOnly();
    error SponsoredOnly();
    error TooManyQuestions();
    error BadQuestion();
    error WrongStatus();
    error HashMismatch();
    error NoAnswerToken();
    error TooLate();
    error TooEarly();
    error AlreadyRevealed();
    error NotAnswerer();
    error AlreadyDisputed();
    error QuestionInFlight();
    error NothingToClaim();
    error BadOutcome();
    error DisputeWindowOpen();
    error SessionKeyTaken();

    // ---------------------------------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------------------------------

    /// @param forwarder Trusted ERC-2771 forwarder: participants sign requests and a relayer pays the gas,
    ///        so a fresh account with no MON can still play. The forwarder only relays signed requests.
    constructor(address host_, string memory code_, Config memory cfg, address forwarder) ERC2771Context(forwarder) {
        if (cfg.token == address(0) || host_ == address(0) || cfg.startingDeposit == 0) revert BadQuestion();
        factory = msg.sender; // the deploying factory itself, never relayed
        host = host_;
        code = code_;
        token = IERC20(cfg.token);
        playPrice = cfg.playPrice;
        startingDeposit = cfg.startingDeposit;
        sponsored = cfg.sponsored;
        hostPlays = cfg.hostPlays;
    }

    modifier onlyHost() {
        if (_msgSender() != host) revert NotHost();
        _;
    }

    modifier open() {
        if (closed) revert RoomIsClosed();
        _;
    }

    // ---------------------------------------------------------------------------------------------
    // Participants & deposits
    // ---------------------------------------------------------------------------------------------

    /// @notice Check in. Sponsored rooms credit the starting deposit from the host's budget; pooled rooms
    ///         pull it from the participant (needs a prior ERC-20 approval).
    function join(string calldata code_, string calldata displayName) external open nonReentrant {
        if (keccak256(bytes(code_)) != keccak256(bytes(code))) revert WrongCode();
        if (_msgSender() == host && !hostPlays) revert HostCannotJoin();
        if (joined[_msgSender()]) revert AlreadyJoined();
        if (_participantList.length >= MAX_PARTICIPANTS) revert RoomFull();

        if (sponsored) {
            if (budget < startingDeposit) revert InsufficientBudget();
            budget -= startingDeposit;
        } else {
            token.safeTransferFrom(_msgSender(), address(this), startingDeposit);
        }

        joined[_msgSender()] = true;
        _participantList.push(_msgSender());
        participants[_msgSender()].deposit = startingDeposit;
        displayNames[_msgSender()] = displayName;

        emit Joined(_msgSender(), displayName, startingDeposit);
        emit Deposited(_msgSender(), startingDeposit, sponsored);
    }

    /// @notice Leave for good: remaining deposit is refunded, re-joining this room is impossible.
    ///         An Answer for the currently open question is forfeited (its play stays in the pot).
    function leave() external nonReentrant {
        Participant storage p = participants[_msgSender()];
        if (!joined[_msgSender()] || p.left) revert NotParticipant();
        uint128 refund = p.deposit;
        p.deposit = 0;
        p.left = true;
        if (refund > 0) token.safeTransfer(_msgSender(), refund);
        emit Left(_msgSender(), refund);
    }

    /// @notice Pooled rooms: add to your own deposit.
    function topUp(uint128 amount) external open nonReentrant {
        if (sponsored) revert PooledOnly();
        if (amount == 0) revert ZeroAmount();
        Participant storage p = participants[_msgSender()];
        if (!joined[_msgSender()] || p.left) revert NotParticipant();
        token.safeTransferFrom(_msgSender(), address(this), amount);
        p.deposit += amount;
        emit Deposited(_msgSender(), amount, false);
    }

    /// @notice Sponsored rooms: host adds to the budget that `join` and `credit` draw from.
    function fundBudget(uint128 amount) external open onlyHost nonReentrant {
        if (!sponsored) revert SponsoredOnly();
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(_msgSender(), address(this), amount);
        budget += amount;
        emit BudgetFunded(_msgSender(), amount);
    }

    /// @notice Sponsored rooms: host moves budget into one participant's deposit (e.g. they ran out of plays).
    function credit(address participant, uint128 amount) external open onlyHost {
        if (!sponsored) revert SponsoredOnly();
        if (amount == 0) revert ZeroAmount();
        Participant storage p = participants[participant];
        if (!joined[participant] || p.left) revert NotParticipant();
        if (budget < amount) revert InsufficientBudget();
        budget -= amount;
        p.deposit += amount;
        emit Deposited(participant, amount, true);
    }

    /// @notice Fallback for delegated signing: let `key` act as you for commit / reveal / dispute / claim.
    function registerSessionKey(address key, uint64 expiry) external {
        Participant storage p = participants[_msgSender()];
        if (!joined[_msgSender()] || p.left) revert NotParticipant();
        if (key == address(0) || joined[key]) revert BadQuestion();
        // A key already acting for someone else cannot be re-pointed; only its owner may renew it.
        address current = sessionKeyOwner[key];
        if (current != address(0) && current != _msgSender()) revert SessionKeyTaken();
        sessionKeyOwner[key] = _msgSender();
        sessionKeyExpiry[key] = expiry;
        emit SessionKeyRegistered(_msgSender(), key, expiry);
    }

    // ---------------------------------------------------------------------------------------------
    // Questions — host side
    // ---------------------------------------------------------------------------------------------

    /// @notice Seal questions. Each hash is keccak256(abi.encode(text, options, template, rule, n, hostSalt)).
    function commitQuestions(bytes32[] calldata hashes) external open onlyHost {
        if (_questions.length + hashes.length > MAX_QUESTIONS) revert TooManyQuestions();
        for (uint256 i = 0; i < hashes.length; i++) {
            if (hashes[i] == bytes32(0)) revert BadQuestion();
            uint256 id = _questions.length;
            _questions.push();
            _questions[id].commitHash = hashes[i];
            emit QuestionCommitted(id, hashes[i]);
        }
    }

    /// @notice Reveal a sealed question and open it: charges one play from every participant with enough
    ///         deposit into the pot, mints Answer_i to each, pulls the host seed, starts the timer.
    function openQuestion(
        uint256 id,
        string calldata text,
        string[] calldata options,
        Template template,
        Rule rule,
        uint8 n,
        bytes32 hostSalt,
        uint128 seed,
        uint32 timer
    ) external open onlyHost nonReentrant {
        Question storage q = _questions[id];
        if (q.status != Status.DRAFT) revert WrongStatus();
        if (keccak256(abi.encode(text, options, template, rule, n, hostSalt)) != q.commitHash) revert HashMismatch();
        if (template == Template.CHOICE) {
            if (options.length < 2 || options.length > MAX_OPTIONS) revert BadQuestion();
        } else if (options.length != 0) {
            revert BadQuestion();
        }
        if (rule == Rule.FASTEST_N && n == 0) revert BadQuestion();
        if (timer < MIN_TIMER || timer > MAX_TIMER) revert BadQuestion();
        if (playPrice == 0 && seed == 0) revert BadQuestion();

        _finalizeActive();

        if (seed > 0) token.safeTransferFrom(_msgSender(), address(this), seed);

        q.text = text;
        for (uint256 i = 0; i < options.length; i++) {
            q.options.push(options[i]);
        }
        q.template = template;
        q.rule = rule;
        q.n = n;
        q.hostSeed = seed;
        q.resolver = host;

        _chargePlays(id, seed);
        _startTimer(id, timer);

        emit QuestionOpened(id, text, options, template, rule, n, seed, q.pot, q.charged, q.lockAt, q.revealUntil);
    }

    /// @notice Anyone may mark the timer as over once `lockAt` has passed (clients normally do this via reveal).
    function lock(uint256 id) external {
        _advance(id);
        if (_questions[id].status != Status.REVEAL) revert WrongStatus();
    }

    /// @notice Set the outcome. Mints Correct_i to everyone right (SPLIT) or the first N right by reveal order
    ///         (FASTEST_N) and opens the dispute window. Nobody right voids the question and refunds plays.
    /// @dev Callable once the reveal window closed, or earlier once every answerer has revealed.
    function resolve(uint256 id, bytes32 outcome) external open nonReentrant {
        Question storage q = _questions[id];
        if (_msgSender() != q.resolver) revert NotResolver();
        _advance(id);
        if (q.status != Status.REVEAL) revert WrongStatus();
        if (block.timestamp <= q.revealUntil && q.revealed < q.answerers) revert TooEarly();

        address[] storage order = _revealers[id];
        uint256 len = order.length;
        uint256 limit = q.rule == Rule.FASTEST_N ? q.n : type(uint256).max;
        int256 target;
        int256 minDist = type(int256).max;

        if (q.template == Template.CHOICE) {
            if (uint256(outcome) >= q.options.length) revert BadOutcome();
        } else {
            bool ok;
            (target, ok) = _toNumber(outcome);
            if (!ok) revert BadOutcome();
            if (q.template == Template.NEAREST) {
                for (uint256 i = 0; i < len; i++) {
                    (int256 v, bool vok) = _toNumber(_answers[id][order[i]].answer);
                    if (!vok) continue;
                    int256 d = _abs(v - target);
                    if (d < minDist) minDist = d;
                }
            }
        }

        uint32 winners;
        for (uint256 i = 0; i < len && winners < limit; i++) {
            address a = order[i];
            bytes32 ans = _answers[id][a].answer;
            bool correct;
            if (q.template == Template.NEAREST) {
                (int256 v, bool vok) = _toNumber(ans);
                correct = vok && _abs(v - target) == minDist;
            } else {
                correct = ans == outcome;
            }
            if (!correct) continue;
            winners++;
            hasCorrectToken[id][a] = true;
            participants[a].correctTotal++;
            _winners[id].push(a);
            emit CorrectMinted(id, a);
        }

        q.outcome = outcome;
        if (winners == 0) {
            _void(id, "nobody right");
            return;
        }
        q.status = Status.RESOLVED;
        q.disputeUntil = uint64(block.timestamp) + DISPUTE_WINDOW;
        emit Resolved(id, outcome, winners, q.disputeUntil);
    }

    /// @notice Pay the pot out once the dispute window has passed. Push for <= PUSH_LIMIT winners, else pull.
    function settle(uint256 id) external nonReentrant {
        Question storage q = _questions[id];
        if (q.status != Status.RESOLVED) revert WrongStatus();
        if (block.timestamp <= q.disputeUntil) revert DisputeWindowOpen();
        _settle(id);
    }

    /// @notice Pull your payout for a question settled with more than PUSH_LIMIT winners.
    function claim(uint256 id) external nonReentrant {
        address actor = _actor();
        uint128 amount = claimable[id][actor];
        if (amount == 0) revert NothingToClaim();
        claimable[id][actor] = 0;
        _answers[id][actor].claimed = true;
        token.safeTransfer(actor, amount);
        emit Claimed(id, actor, amount);
    }

    /// @notice Host silent for HOST_TIMEOUT after the timer ended: anyone may void and refund.
    function voidByTimeout(uint256 id) external nonReentrant {
        Question storage q = _questions[id];
        if (q.status != Status.OPEN && q.status != Status.REVEAL) revert WrongStatus();
        if (block.timestamp <= q.lockAt + HOST_TIMEOUT) revert TooEarly();
        _void(id, "host timeout");
    }

    /// @notice End the session: settle or void the question in flight, refund every deposit, return budget
    ///         and dust to the host. Pending pull payouts stay claimable.
    function closeRoom() external open onlyHost nonReentrant {
        if (hasActive) {
            Question storage q = _questions[activeQuestion];
            if (q.status == Status.RESOLVED) {
                if (block.timestamp <= q.disputeUntil) revert DisputeWindowOpen();
                _settle(activeQuestion);
            } else {
                _void(activeQuestion, "room closed");
            }
        }
        closed = true;

        uint128 refunded;
        uint256 len = _participantList.length;
        for (uint256 i = 0; i < len; i++) {
            address a = _participantList[i];
            Participant storage p = participants[a];
            if (p.left || p.deposit == 0) continue;
            uint128 amount = p.deposit;
            p.deposit = 0;
            refunded += amount;
            token.safeTransfer(a, amount);
            emit Refunded(a, amount);
        }

        uint128 toHost = budget + dust;
        budget = 0;
        dust = 0;
        if (toHost > 0) token.safeTransfer(host, toHost);
        emit RoomClosed(refunded, toHost);
    }

    // ---------------------------------------------------------------------------------------------
    // Questions — participant side (callable through a registered session key)
    // ---------------------------------------------------------------------------------------------

    /// @notice Burn your Answer_i and store keccak256(abi.encode(answer, salt)). Once per question.
    function commitAnswer(uint256 id, bytes32 commitHash) external open {
        address actor = _actor();
        Question storage q = _questions[id];
        if (q.status != Status.OPEN) revert WrongStatus();
        if (block.timestamp >= q.lockAt) revert TooLate();
        if (!hasAnswerToken[id][actor]) revert NoAnswerToken();
        if (commitHash == bytes32(0)) revert BadQuestion();

        hasAnswerToken[id][actor] = false;
        emit AnswerBurned(id, actor);
        _answers[id][actor].commitHash = commitHash;
        q.answerers++;
        emit AnswerCommitted(id, actor, commitHash);
    }

    /// @notice Reveal within the window. Records block and reveal index (the on-chain order used by FASTEST_N).
    function revealAnswer(uint256 id, bytes32 answer, bytes32 salt) external open {
        address actor = _actor();
        _advance(id);
        Question storage q = _questions[id];
        if (q.status != Status.REVEAL) revert WrongStatus();
        if (block.timestamp > q.revealUntil) revert TooLate();
        Answer storage a = _answers[id][actor];
        if (a.commitHash == bytes32(0)) revert NotAnswerer();
        if (a.revealed) revert AlreadyRevealed();
        if (keccak256(abi.encode(answer, salt)) != a.commitHash) revert HashMismatch();

        a.answer = answer;
        a.revealed = true;
        a.revealBlock = uint64(block.number);
        a.revealIndex = q.revealed;
        q.revealed++;
        _revealers[id].push(actor);
        emit AnswerRevealed(id, actor, answer, a.revealBlock, a.revealIndex);
    }

    /// @notice Disagree with the result. One third of answerers within the window voids the question.
    function dispute(uint256 id) external open nonReentrant {
        address actor = _actor();
        Question storage q = _questions[id];
        if (q.status != Status.RESOLVED) revert WrongStatus();
        if (block.timestamp > q.disputeUntil) revert TooLate();
        if (_answers[id][actor].commitHash == bytes32(0)) revert NotAnswerer();
        if (hasDisputed[id][actor]) revert AlreadyDisputed();

        hasDisputed[id][actor] = true;
        q.disputes++;
        emit Disputed(id, actor, q.disputes);

        if (uint256(q.disputes) * 3 >= q.answerers) {
            address[] storage w = _winners[id];
            for (uint256 i = 0; i < w.length; i++) {
                hasCorrectToken[id][w[i]] = false;
                participants[w[i]].correctTotal--;
                emit CorrectBurned(id, w[i]);
            }
            delete _winners[id];
            _void(id, "disputed");
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    function questionCount() external view returns (uint256) {
        return _questions.length;
    }

    function getQuestion(uint256 id) external view returns (Question memory) {
        return _questions[id];
    }

    function getAnswer(uint256 id, address participant) external view returns (Answer memory) {
        return _answers[id][participant];
    }

    function getWinners(uint256 id) external view returns (address[] memory) {
        return _winners[id];
    }

    function getRevealers(uint256 id) external view returns (address[] memory) {
        return _revealers[id];
    }

    function getParticipants() external view returns (address[] memory) {
        return _participantList;
    }

    /// @notice Time-adjusted status: OPEN past `lockAt` reads as LOCKED until a reveal/lock tx advances it.
    function phase(uint256 id) external view returns (Status) {
        Question storage q = _questions[id];
        if (q.status == Status.OPEN && block.timestamp >= q.lockAt) return Status.LOCKED;
        return q.status;
    }

    /// @notice Hash helper for hosts: what `commitQuestions` expects.
    function questionHash(
        string calldata text,
        string[] calldata options,
        Template template,
        Rule rule,
        uint8 n,
        bytes32 hostSalt
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(text, options, template, rule, n, hostSalt));
    }

    /// @notice Hash helper for participants: what `commitAnswer` expects.
    function answerHash(bytes32 answer, bytes32 salt) external pure returns (bytes32) {
        return keccak256(abi.encode(answer, salt));
    }

    // ---------------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------------

    /// @dev Effective participant: the signer (direct caller, or the signer of a relayed request), mapped to
    ///      its owner when the signer is a registered, unexpired session key.
    function _actor() internal view returns (address) {
        address sender = _msgSender();
        address owner = sessionKeyOwner[sender];
        if (owner != address(0) && sessionKeyExpiry[sender] >= block.timestamp) return owner;
        return sender;
    }

    /// @dev Charge one play from every participant with enough deposit, mint Answer_i, fund the pot
    ///      (seed + carried dust + plays).
    function _chargePlays(uint256 id, uint128 seed) internal {
        Question storage q = _questions[id];
        uint128 pot = seed + dust;
        dust = 0;
        uint32 charged;
        uint256 len = _participantList.length;
        for (uint256 i = 0; i < len; i++) {
            address a = _participantList[i];
            Participant storage p = participants[a];
            if (p.left || p.deposit < playPrice) continue;
            p.deposit -= playPrice;
            pot += playPrice;
            charged++;
            hasAnswerToken[id][a] = true;
            wasCharged[id][a] = true;
            emit AnswerMinted(id, a, playPrice);
        }
        q.pot = pot;
        q.charged = charged;
    }

    function _startTimer(uint256 id, uint32 timer) internal {
        Question storage q = _questions[id];
        uint64 nowTs = uint64(block.timestamp);
        q.openAt = nowTs;
        q.lockAt = nowTs + timer;
        q.revealUntil = q.lockAt + REVEAL_WINDOW;
        q.status = Status.OPEN;
        hasActive = true;
        activeQuestion = id;
    }

    /// @dev OPEN → REVEAL once the timer is over. Emits the lock transition exactly once.
    function _advance(uint256 id) internal {
        Question storage q = _questions[id];
        if (q.status == Status.OPEN && block.timestamp >= q.lockAt) {
            q.status = Status.REVEAL;
            emit QuestionLocked(id, q.lockAt);
        }
    }

    /// @dev The previous question must be final before the next opens. A RESOLVED question whose dispute
    ///      window passed is settled here so the host needs no extra transaction.
    function _finalizeActive() internal {
        if (!hasActive) return;
        Question storage q = _questions[activeQuestion];
        if (q.status == Status.RESOLVED && block.timestamp > q.disputeUntil) {
            _settle(activeQuestion);
            return;
        }
        revert QuestionInFlight();
    }

    /// @dev Split the pot evenly among Correct_i holders. A host who played never receives part of the seed.
    ///      Push for <= PUSH_LIMIT winners, otherwise mark claimable. Remainder becomes dust.
    function _settle(uint256 id) internal {
        Question storage q = _questions[id];
        uint256 k = _winners[id].length;
        (uint128 playShare, uint128 seedShare, uint256 others) = _shares(id, k);
        bool push = k <= PUSH_LIMIT;
        uint128 paid;

        for (uint256 i = 0; i < k; i++) {
            address a = _winners[id][i];
            paid += _pay(id, a, playShare + (a == host ? 0 : seedShare), push);
        }

        uint128 seedBack;
        if (others == 0 && q.hostSeed > 0) {
            seedBack = q.hostSeed;
            token.safeTransfer(host, seedBack);
            emit SeedReturned(id, seedBack);
        }
        dust += q.pot - paid - seedBack;

        q.status = Status.SETTLED;
        hasActive = false;
        emit Settled(id, paid, uint32(k), push);
    }

    /// @dev Per-winner share of the plays and of the seed. `others` = winners other than the host.
    function _shares(uint256 id, uint256 k)
        internal
        view
        returns (uint128 playShare, uint128 seedShare, uint256 others)
    {
        Question storage q = _questions[id];
        others = hasCorrectToken[id][host] ? k - 1 : k;
        playShare = uint128((q.pot - q.hostSeed) / k);
        seedShare = others > 0 ? uint128(q.hostSeed / others) : 0;
    }

    function _pay(uint256 id, address to, uint128 amount, bool push) internal returns (uint128) {
        if (push) {
            _answers[id][to].claimed = true;
            token.safeTransfer(to, amount);
            emit Claimed(id, to, amount);
        } else {
            claimable[id][to] = amount;
            emit Claimable(id, to, amount);
        }
        return amount;
    }

    /// @dev Refund every charged play (to the deposit, or directly if the participant has left), return the
    ///      seed to the host, carry any inherited dust forward.
    function _void(uint256 id, string memory reason) internal {
        Question storage q = _questions[id];
        uint128 pot = q.pot;
        uint256 len = _participantList.length;
        for (uint256 i = 0; i < len; i++) {
            address a = _participantList[i];
            if (!wasCharged[id][a]) continue;
            pot -= playPrice;
            if (participants[a].left) {
                token.safeTransfer(a, playPrice);
            } else {
                participants[a].deposit += playPrice;
            }
        }
        if (q.hostSeed > 0) {
            pot -= q.hostSeed;
            token.safeTransfer(host, q.hostSeed);
            emit SeedReturned(id, q.hostSeed);
        }
        dust += pot;
        q.status = Status.VOIDED;
        if (hasActive && activeQuestion == id) hasActive = false;
        emit Voided(id, reason);
    }

    /// @dev Numeric answers/outcomes are int256 stored in bytes32; anything outside int128 is rejected so that
    ///      distances cannot overflow.
    function _toNumber(bytes32 raw) internal pure returns (int256 v, bool ok) {
        v = int256(uint256(raw));
        ok = v >= type(int128).min && v <= type(int128).max;
    }

    function _abs(int256 x) internal pure returns (int256) {
        return x < 0 ? -x : x;
    }
}
