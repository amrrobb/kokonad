// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RoomTestBase} from "./RoomTestBase.sol";
import {Room} from "../src/Room.sol";

/// @dev Unit tests for Room: one behaviour per test. The full lifecycle lives in Room.e2e.t.sol.
contract RoomTest is RoomTestBase {
    Room internal room;
    string internal code;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint128 internal constant PLAY = 2e18;
    uint128 internal constant DEPOSIT = 20e18;

    function setUp() public override {
        super.setUp();
        (room, code) = _createRoom(PLAY, DEPOSIT, false, false);
    }

    // ------------------------------------------------------------------ join / leave / deposits

    function test_joinPooledPullsDeposit() public {
        _fund(alice, address(room), DEPOSIT);
        vm.expectEmit(true, false, false, true);
        emit Room.Joined(alice, "Alice", DEPOSIT);
        vm.expectEmit(true, false, false, true);
        emit Room.Deposited(alice, DEPOSIT, false);
        _join(room, code, alice, "Alice");

        assertEq(_deposit(room, alice), DEPOSIT);
        assertEq(token.balanceOf(address(room)), DEPOSIT);
        assertEq(token.balanceOf(alice), 0);
        assertEq(room.displayNames(alice), "Alice");
        assertEq(room.getParticipants().length, 1);
    }

    function test_joinWrongCodeReverts() public {
        _fund(alice, address(room), DEPOSIT);
        vm.prank(alice);
        vm.expectRevert(Room.WrongCode.selector);
        room.join("NOPE00", "Alice");
    }

    function test_joinTwiceReverts() public {
        _joinPooled(room, code, alice, "Alice");
        _fund(alice, address(room), DEPOSIT);
        vm.prank(alice);
        vm.expectRevert(Room.AlreadyJoined.selector);
        room.join(code, "Alice again");
    }

    function test_joinWithoutApprovalReverts() public {
        token.mint(alice, DEPOSIT);
        vm.prank(alice);
        vm.expectRevert();
        room.join(code, "Alice");
    }

    function test_hostCannotJoinUnlessHostPlays() public {
        _fund(host, address(room), DEPOSIT);
        vm.prank(host);
        vm.expectRevert(Room.HostCannotJoin.selector);
        room.join(code, "Host");

        (Room r2, string memory c2) = _createRoom(PLAY, DEPOSIT, false, true);
        _joinPooled(r2, c2, host, "Host");
        assertEq(_deposit(r2, host), DEPOSIT);
    }

    function test_joinSponsoredCreditsFromBudget() public {
        (Room r, string memory c) = _createRoom(1e18, DEPOSIT, true, false);
        vm.prank(alice);
        vm.expectRevert(Room.InsufficientBudget.selector);
        r.join(c, "Alice");

        _fundBudget(r, 3 * DEPOSIT);
        assertEq(r.budget(), 3 * DEPOSIT);
        _join(r, c, alice, "Alice");
        assertEq(_deposit(r, alice), DEPOSIT);
        assertEq(r.budget(), 2 * DEPOSIT);
        assertEq(token.balanceOf(alice), 0, "participant paid nothing");
    }

    function test_sponsoredCreditAndPooledTopUpAreModeGated() public {
        (Room r, string memory c) = _createRoom(1e18, DEPOSIT, true, false);
        _fundBudget(r, 2 * DEPOSIT);
        _join(r, c, alice, "Alice");

        vm.prank(alice);
        vm.expectRevert(Room.PooledOnly.selector);
        r.topUp(1e18);

        vm.prank(host);
        r.credit(alice, 5e18);
        assertEq(_deposit(r, alice), DEPOSIT + 5e18);
        assertEq(r.budget(), DEPOSIT - 5e18);

        vm.prank(host);
        vm.expectRevert(Room.InsufficientBudget.selector);
        r.credit(alice, DEPOSIT);

        // pooled room: fundBudget/credit are host-only and sponsored-only
        _joinPooled(room, code, bob, "Bob");
        vm.prank(host);
        vm.expectRevert(Room.SponsoredOnly.selector);
        room.credit(bob, 1);
        _fund(bob, address(room), 3e18);
        vm.prank(bob);
        room.topUp(3e18);
        assertEq(_deposit(room, bob), DEPOSIT + 3e18);
    }

    function test_roomFullAtFifty() public {
        for (uint256 i = 0; i < 50; i++) {
            _joinPooled(room, code, makeAddr(string(abi.encodePacked("p", i))), "p");
        }
        _fund(alice, address(room), DEPOSIT);
        vm.prank(alice);
        vm.expectRevert(Room.RoomFull.selector);
        room.join(code, "Alice");
    }

    function test_leaveRefundsAndIsPermanent() public {
        _joinPooled(room, code, alice, "Alice");
        vm.expectEmit(true, false, false, true);
        emit Room.Left(alice, DEPOSIT);
        vm.prank(alice);
        room.leave();
        assertEq(token.balanceOf(alice), DEPOSIT);
        assertEq(_deposit(room, alice), 0);

        _fund(alice, address(room), DEPOSIT);
        vm.prank(alice);
        vm.expectRevert(Room.AlreadyJoined.selector);
        room.join(code, "Alice");

        vm.prank(alice);
        vm.expectRevert(Room.NotParticipant.selector);
        room.leave();
    }

    function test_leaveMidQuestionForfeitsPlay() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        vm.prank(alice);
        room.leave();
        assertEq(token.balanceOf(alice), DEPOSIT - PLAY, "play stays in the pot");
        assertEq(room.getQuestion(id).pot, 2 * PLAY);
    }

    // ------------------------------------------------------------------ commit / open questions

    function test_commitQuestionsOnlyHost() public {
        bytes32[] memory h = new bytes32[](1);
        h[0] = bytes32(uint256(1));
        vm.prank(alice);
        vm.expectRevert(Room.NotHost.selector);
        room.commitQuestions(h);

        vm.expectEmit(true, false, false, true);
        emit Room.QuestionCommitted(0, h[0]);
        vm.prank(host);
        room.commitQuestions(h);
        assertEq(room.questionCount(), 1);
        assertEq(uint8(room.getQuestion(0).status), uint8(Room.Status.DRAFT));
    }

    function test_openQuestionHashMismatchReverts() public {
        Q memory q = _choice("Who wins?", 0, Room.Rule.SPLIT);
        uint256 id = _commit(room, q);
        vm.prank(host);
        vm.expectRevert(Room.HashMismatch.selector);
        room.openQuestion(id, "Who loses?", q.options, q.template, q.rule, q.n, q.salt, 0, 30);
    }

    function test_openQuestionChargesEveryoneWithEnoughDeposit() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        _joinPooled(room, code, carol, "Carol");
        Q memory q = _choice("Q1", 0, Room.Rule.SPLIT);
        uint256 id = _commit(room, q);
        _open(room, id, q, 5e18, 30);

        Room.Question memory qq = room.getQuestion(id);
        assertEq(qq.pot, 3 * PLAY + 5e18);
        assertEq(qq.charged, 3);
        assertEq(qq.hostSeed, 5e18);
        assertEq(qq.text, "Q1");
        assertEq(qq.options.length, 3);
        assertEq(qq.lockAt, uint64(block.timestamp) + 30);
        assertEq(qq.revealUntil, qq.lockAt + room.REVEAL_WINDOW());
        assertEq(uint8(qq.status), uint8(Room.Status.OPEN));
        assertEq(qq.resolver, host);
        assertTrue(room.hasAnswerToken(id, alice) && room.hasAnswerToken(id, bob) && room.hasAnswerToken(id, carol));
        assertTrue(room.wasCharged(id, alice) && room.wasCharged(id, bob) && room.wasCharged(id, carol));
        assertEq(_deposit(room, alice), DEPOSIT - PLAY);
        assertEq(token.balanceOf(host), 0, "seed pulled from host");
        assertTrue(room.hasActive());
        assertEq(room.activeQuestion(), id);
    }

    function test_openQuestionSkipsDepositBelowPlayPrice() public {
        (Room r, string memory c) = _createRoom(15e18, DEPOSIT, false, false);
        _joinPooled(r, c, alice, "Alice");
        _joinPooled(r, c, bob, "Bob");
        uint256 q1 = _commitAndOpen(r, _choice("Q1", 0, Room.Rule.SPLIT), 0, 30);
        assertEq(r.getQuestion(q1).charged, 2);
        _answer(r, q1, alice, _opt(0));
        _warpToLock(r, q1);
        _reveal(r, q1, alice, _opt(0));
        _resolve(r, q1, _opt(0));
        _warpPastDispute(r, q1);

        // deposits are now 5 each: below 15, nobody is charged and nobody gets an Answer
        uint256 q2 = _commitAndOpen(r, _choice("Q2", 0, Room.Rule.SPLIT), 1e18, 30);
        assertEq(r.getQuestion(q2).charged, 0);
        assertFalse(r.hasAnswerToken(q2, alice));
        vm.prank(alice);
        vm.expectRevert(Room.NoAnswerToken.selector);
        r.commitAnswer(q2, bytes32(uint256(1)));
    }

    function test_openQuestionValidation() public {
        Q memory q = _choice("Q", 0, Room.Rule.SPLIT);
        uint256 id = _commit(room, q);
        vm.prank(host);
        vm.expectRevert(Room.BadQuestion.selector);
        room.openQuestion(id, q.text, q.options, q.template, q.rule, q.n, q.salt, 0, 1); // timer too short

        Q memory bad = _choice("Q2", 0, Room.Rule.FASTEST_N); // n == 0
        uint256 id2 = _commit(room, bad);
        vm.prank(host);
        vm.expectRevert(Room.BadQuestion.selector);
        room.openQuestion(id2, bad.text, bad.options, bad.template, bad.rule, bad.n, bad.salt, 0, 30);

        (Room free,) = _createRoom(0, DEPOSIT, false, false); // playPrice 0 and seed 0
        Q memory q3 = _choice("Q3", 0, Room.Rule.SPLIT);
        uint256 id3 = _commit(free, q3);
        vm.prank(host);
        vm.expectRevert(Room.BadQuestion.selector);
        free.openQuestion(id3, q3.text, q3.options, q3.template, q3.rule, q3.n, q3.salt, 0, 30);
    }

    function test_onlyOneQuestionInFlight() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 q1 = _commitAndOpen(room, _choice("Q1", 0, Room.Rule.SPLIT), 0, 30);
        Q memory q2 = _choice("Q2", 0, Room.Rule.SPLIT);
        uint256 id2 = _commit(room, q2);
        vm.prank(host);
        vm.expectRevert(Room.QuestionInFlight.selector);
        room.openQuestion(id2, q2.text, q2.options, q2.template, q2.rule, q2.n, q2.salt, 0, 30);

        // resolve q1, wait out the dispute window: opening q2 auto-settles q1
        _answer(room, q1, alice, _opt(1));
        _warpToLock(room, q1);
        _reveal(room, q1, alice, _opt(1));
        _resolve(room, q1, _opt(1));
        vm.prank(host);
        vm.expectRevert(Room.QuestionInFlight.selector);
        room.openQuestion(id2, q2.text, q2.options, q2.template, q2.rule, q2.n, q2.salt, 0, 30);
        _warpPastDispute(room, q1);
        _open(room, id2, q2, 0, 30);
        assertEq(uint8(room.getQuestion(q1).status), uint8(Room.Status.SETTLED));
        assertEq(token.balanceOf(alice), PLAY, "q1 pot paid out on auto-settle");
    }

    // ------------------------------------------------------------------ commit / reveal answers

    function test_commitAnswerBurnsAnswerTokenOnce() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        bytes32 h = keccak256(abi.encode(_opt(1), _salt(alice, id)));

        vm.expectEmit(true, true, false, true);
        emit Room.AnswerBurned(id, alice);
        vm.expectEmit(true, true, false, true);
        emit Room.AnswerCommitted(id, alice, h);
        vm.prank(alice);
        room.commitAnswer(id, h);

        assertFalse(room.hasAnswerToken(id, alice));
        assertEq(room.getQuestion(id).answerers, 1);
        vm.prank(alice);
        vm.expectRevert(Room.NoAnswerToken.selector);
        room.commitAnswer(id, h);
    }

    function test_commitAfterLockReverts() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _warpToLock(room, id);
        assertEq(uint8(room.phase(id)), uint8(Room.Status.LOCKED));
        vm.prank(alice);
        vm.expectRevert(Room.TooLate.selector);
        room.commitAnswer(id, bytes32(uint256(1)));
    }

    function test_revealBeforeLockReverts() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(1));
        vm.prank(alice);
        vm.expectRevert(Room.WrongStatus.selector);
        room.revealAnswer(id, _opt(1), _salt(alice, id));
    }

    function test_revealWrongSaltOrTwiceOrLateReverts() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(1));
        _answer(room, id, bob, _opt(2));
        _warpToLock(room, id);

        vm.prank(alice);
        vm.expectRevert(Room.HashMismatch.selector);
        room.revealAnswer(id, _opt(1), bytes32(0));
        vm.prank(alice);
        vm.expectRevert(Room.HashMismatch.selector);
        room.revealAnswer(id, _opt(2), _salt(alice, id));

        vm.expectEmit(true, true, false, true);
        emit Room.QuestionLocked(id, _lockTime(room, id));
        vm.expectEmit(true, true, false, true);
        emit Room.AnswerRevealed(id, alice, _opt(1), uint64(block.number), 0);
        _reveal(room, id, alice, _opt(1));
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.REVEAL));

        vm.prank(alice);
        vm.expectRevert(Room.AlreadyRevealed.selector);
        room.revealAnswer(id, _opt(1), _salt(alice, id));

        vm.prank(carol);
        vm.expectRevert(Room.NotAnswerer.selector);
        room.revealAnswer(id, _opt(1), _salt(carol, id));

        vm.warp(room.getQuestion(id).revealUntil + 1);
        vm.prank(bob);
        vm.expectRevert(Room.TooLate.selector);
        room.revealAnswer(id, _opt(2), _salt(bob, id));
    }

    function test_sessionKeyActsForParticipant() public {
        _joinPooled(room, code, alice, "Alice");
        address key = makeAddr("session-key");
        uint64 expiry = uint64(block.timestamp + 10);
        vm.expectEmit(true, true, false, true);
        emit Room.SessionKeyRegistered(alice, key, expiry);
        vm.prank(alice);
        room.registerSessionKey(key, expiry);

        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);

        // expired key falls back to acting as itself, and the key holds no Answer
        vm.warp(expiry + 1);
        vm.prank(key);
        vm.expectRevert(Room.NoAnswerToken.selector);
        room.commitAnswer(id, keccak256(abi.encode(_opt(0), _salt(alice, id))));

        vm.prank(alice);
        room.registerSessionKey(key, uint64(block.timestamp + 1 hours));
        vm.prank(key);
        room.commitAnswer(id, keccak256(abi.encode(_opt(0), _salt(alice, id))));
        assertFalse(room.hasAnswerToken(id, alice), "burned from Alice, not the key");
        _warpToLock(room, id);
        vm.prank(key);
        room.revealAnswer(id, _opt(0), _salt(alice, id));
        assertTrue(room.getAnswer(id, alice).revealed);

        _resolve(room, id, _opt(0));
        vm.prank(key);
        room.dispute(id); // 1 of 1 answerers: voids, proving the key acted as Alice
        assertTrue(room.hasDisputed(id, alice));
        assertFalse(room.hasDisputed(id, key));
    }

    // ------------------------------------------------------------------ resolve

    function test_resolveOnlyResolverAndNotBeforeRevealWindowUnlessAllRevealed() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(0));
        _answer(room, id, bob, _opt(1));

        vm.prank(alice);
        vm.expectRevert(Room.NotResolver.selector);
        room.resolve(id, _opt(0));

        vm.prank(host);
        vm.expectRevert(Room.WrongStatus.selector); // still OPEN, timer running
        room.resolve(id, _opt(0));

        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        vm.prank(host);
        vm.expectRevert(Room.TooEarly.selector); // Bob hasn't revealed, window still open
        room.resolve(id, _opt(0));

        _reveal(room, id, bob, _opt(1));
        vm.expectEmit(true, true, false, true);
        emit Room.CorrectMinted(id, alice);
        vm.expectEmit(true, false, false, true);
        emit Room.Resolved(id, _opt(0), 1, uint64(block.timestamp) + room.DISPUTE_WINDOW());
        _resolve(room, id, _opt(0)); // everyone revealed: allowed early
        assertTrue(room.hasCorrectToken(id, alice));
        assertFalse(room.hasCorrectToken(id, bob));
        assertEq(_correctTotal(room, alice), 1);
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.RESOLVED));
    }

    function test_resolveInvalidChoiceOutcomeReverts() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(0));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        vm.prank(host);
        vm.expectRevert(Room.BadOutcome.selector);
        room.resolve(id, _opt(3));
    }

    function test_nobodyRightVoidsAndRefundsPlays() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 6e18, 30);
        _answer(room, id, alice, _opt(1));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(1));
        vm.warp(room.getQuestion(id).revealUntil + 1);

        vm.expectEmit(true, false, false, true);
        emit Room.SeedReturned(id, 6e18);
        vm.expectEmit(true, false, false, true);
        emit Room.Voided(id, "nobody right");
        _resolve(room, id, _opt(0));

        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.VOIDED));
        assertEq(_deposit(room, alice), DEPOSIT, "play refunded to answerer");
        assertEq(_deposit(room, bob), DEPOSIT, "play refunded to the one who sat out");
        assertEq(token.balanceOf(host), 6e18, "seed back to host");
        assertFalse(room.hasActive());
    }

    function test_nearestPicksClosestWithTies() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        _joinPooled(room, code, carol, "Carol");
        uint256 id = _commitAndOpen(room, _numeric("How many?", Room.Template.NEAREST), 0, 30);
        _answer(room, id, alice, _num(90));
        _answer(room, id, bob, _num(110));
        _answer(room, id, carol, _num(-40));
        _warpToLock(room, id);
        _reveal(room, id, alice, _num(90));
        _reveal(room, id, bob, _num(110));
        _reveal(room, id, carol, _num(-40));
        _resolve(room, id, _num(100));
        assertTrue(room.hasCorrectToken(id, alice));
        assertTrue(room.hasCorrectToken(id, bob));
        assertFalse(room.hasCorrectToken(id, carol));
        assertEq(room.getWinners(id).length, 2);
    }

    function test_exactRequiresEquality() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _numeric("Score?", Room.Template.EXACT), 0, 30);
        _answer(room, id, alice, _num(3));
        _answer(room, id, bob, _num(4));
        _warpToLock(room, id);
        _reveal(room, id, alice, _num(3));
        _reveal(room, id, bob, _num(4));
        _resolve(room, id, _num(3));
        assertTrue(room.hasCorrectToken(id, alice));
        assertFalse(room.hasCorrectToken(id, bob));
    }

    function test_fastestNUsesRevealOrder() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        _joinPooled(room, code, carol, "Carol");
        uint256 id = _commitAndOpen(room, _choice("First two", 2, Room.Rule.FASTEST_N), 0, 30);
        _answer(room, id, alice, _opt(0));
        _answer(room, id, bob, _opt(0));
        _answer(room, id, carol, _opt(0));
        _warpToLock(room, id);
        _reveal(room, id, carol, _opt(0)); // index 0
        vm.roll(block.number + 1);
        _reveal(room, id, alice, _opt(0)); // index 1
        _reveal(room, id, bob, _opt(0)); // index 2
        assertEq(room.getAnswer(id, carol).revealIndex, 0);
        assertEq(room.getAnswer(id, bob).revealIndex, 2);
        _resolve(room, id, _opt(0));
        address[] memory w = room.getWinners(id);
        assertEq(w.length, 2);
        assertEq(w[0], carol);
        assertEq(w[1], alice);
        assertFalse(room.hasCorrectToken(id, bob));
    }

    function test_fastestNWithFewerCorrectThanN() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("First three", 3, Room.Rule.FASTEST_N), 0, 30);
        _answer(room, id, alice, _opt(0));
        _answer(room, id, bob, _opt(1));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        _reveal(room, id, bob, _opt(1));
        _resolve(room, id, _opt(0));
        assertEq(room.getWinners(id).length, 1);
    }

    function test_unrevealedCountsAsWrong() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(0));
        _answer(room, id, bob, _opt(0));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        vm.warp(room.getQuestion(id).revealUntil + 1);
        _resolve(room, id, _opt(0));
        assertTrue(room.hasCorrectToken(id, alice));
        assertFalse(room.hasCorrectToken(id, bob), "committed but never revealed");
    }

    // ------------------------------------------------------------------ dispute / settle / claim

    function test_settleWaitsForDisputeWindowThenPushes() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(0));
        _answer(room, id, bob, _opt(0));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        _reveal(room, id, bob, _opt(0));
        _resolve(room, id, _opt(0));

        vm.expectRevert(Room.DisputeWindowOpen.selector);
        room.settle(id);

        _warpPastDispute(room, id);
        vm.expectEmit(true, true, false, true);
        emit Room.Claimed(id, alice, PLAY);
        vm.expectEmit(true, true, false, true);
        emit Room.Claimed(id, bob, PLAY);
        vm.expectEmit(true, false, false, true);
        emit Room.Settled(id, 2 * PLAY, 2, true);
        room.settle(id); // anyone
        assertEq(token.balanceOf(alice), PLAY);
        assertEq(token.balanceOf(bob), PLAY);
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.SETTLED));
        assertTrue(room.getAnswer(id, alice).claimed);

        vm.expectRevert(Room.WrongStatus.selector);
        room.settle(id);
    }

    function test_roundingDustRollsToNextPotThenHost() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        _joinPooled(room, code, carol, "Carol");
        // pot 6e18 + seed 1: 6e18 + 1 split three ways leaves 1 wei of dust
        uint256 q1 = _commitAndOpen(room, _choice("Q1", 0, Room.Rule.SPLIT), 1, 30);
        _answer(room, q1, alice, _opt(0));
        _answer(room, q1, bob, _opt(0));
        _answer(room, q1, carol, _opt(0));
        _warpToLock(room, q1);
        _reveal(room, q1, alice, _opt(0));
        _reveal(room, q1, bob, _opt(0));
        _reveal(room, q1, carol, _opt(0));
        _resolve(room, q1, _opt(0));
        _warpPastDispute(room, q1);
        room.settle(q1);
        assertEq(room.dust(), 1);

        uint256 q2 = _commitAndOpen(room, _choice("Q2", 0, Room.Rule.SPLIT), 0, 30);
        assertEq(room.getQuestion(q2).pot, 3 * PLAY + 1, "dust carried into the next pot");
        assertEq(room.dust(), 0);
        _answer(room, q2, alice, _opt(0));
        _warpToLock(room, q2);
        _reveal(room, q2, alice, _opt(0));
        _resolve(room, q2, _opt(0));
        _warpPastDispute(room, q2);
        room.settle(q2);
        assertEq(room.dust(), 0, "single winner takes the whole pot including the wei");

        uint256 q3 = _commitAndOpen(room, _choice("Q3", 0, Room.Rule.SPLIT), 2, 30);
        _answer(room, q3, alice, _opt(0));
        _answer(room, q3, bob, _opt(0));
        _answer(room, q3, carol, _opt(0));
        _warpToLock(room, q3);
        _reveal(room, q3, alice, _opt(0));
        _reveal(room, q3, bob, _opt(0));
        _reveal(room, q3, carol, _opt(0));
        _resolve(room, q3, _opt(0));
        _warpPastDispute(room, q3);
        room.settle(q3);
        assertEq(room.dust(), 2);
        uint256 hostBefore = token.balanceOf(host);
        vm.prank(host);
        room.closeRoom();
        assertEq(token.balanceOf(host) - hostBefore, 2, "dust goes to the host at close");
    }

    function test_disputeThirdOfAnswerersVoidsAndBurnsCorrect() public {
        _joinPooled(room, code, alice, "Alice");
        _joinPooled(room, code, bob, "Bob");
        _joinPooled(room, code, carol, "Carol");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 3e18, 30);
        _answer(room, id, alice, _opt(0));
        _answer(room, id, bob, _opt(1));
        _answer(room, id, carol, _opt(1));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        _reveal(room, id, bob, _opt(1));
        _reveal(room, id, carol, _opt(1));
        _resolve(room, id, _opt(0));
        assertTrue(room.hasCorrectToken(id, alice));

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(Room.NotAnswerer.selector);
        room.dispute(id);

        // 1 of 3 answerers is exactly one third → void
        vm.expectEmit(true, true, false, true);
        emit Room.Disputed(id, bob, 1);
        vm.expectEmit(true, true, false, true);
        emit Room.CorrectBurned(id, alice);
        vm.expectEmit(true, false, false, true);
        emit Room.Voided(id, "disputed");
        vm.prank(bob);
        room.dispute(id);

        assertFalse(room.hasCorrectToken(id, alice));
        assertEq(_correctTotal(room, alice), 0);
        assertEq(room.getWinners(id).length, 0);
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.VOIDED));
        assertEq(_deposit(room, alice), DEPOSIT);
        assertEq(_deposit(room, carol), DEPOSIT);
        assertEq(token.balanceOf(host), 3e18, "seed returned");

        vm.prank(carol);
        vm.expectRevert(Room.WrongStatus.selector);
        room.dispute(id);
    }

    function test_disputeBelowThresholdKeepsResultAndWindowCloses() public {
        for (uint256 i = 0; i < 4; i++) {
            _joinPooled(room, code, makeAddr(string(abi.encodePacked("p", i))), "p");
        }
        address[] memory ps = room.getParticipants();
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        for (uint256 i = 0; i < 4; i++) {
            _answer(room, id, ps[i], _opt(0));
        }
        _warpToLock(room, id);
        for (uint256 i = 0; i < 4; i++) {
            _reveal(room, id, ps[i], _opt(0));
        }
        _resolve(room, id, _opt(0));
        vm.prank(ps[0]);
        room.dispute(id); // 1 of 4 < 1/3
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.RESOLVED));
        vm.prank(ps[0]);
        vm.expectRevert(Room.AlreadyDisputed.selector);
        room.dispute(id);
        _warpPastDispute(room, id);
        vm.prank(ps[1]);
        vm.expectRevert(Room.TooLate.selector);
        room.dispute(id);
    }

    function test_moreThanTwentyWinnersUsePullPayment() public {
        uint256 n = 25;
        for (uint256 i = 0; i < n; i++) {
            _joinPooled(room, code, makeAddr(string(abi.encodePacked("w", i))), "w");
        }
        address[] memory ps = room.getParticipants();
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        for (uint256 i = 0; i < n; i++) {
            _answer(room, id, ps[i], _opt(2));
        }
        _warpToLock(room, id);
        for (uint256 i = 0; i < n; i++) {
            _reveal(room, id, ps[i], _opt(2));
        }
        _resolve(room, id, _opt(2));
        _warpPastDispute(room, id);
        vm.expectEmit(true, false, false, true);
        emit Room.Settled(id, uint128(n) * PLAY, uint32(n), false);
        room.settle(id);

        assertEq(token.balanceOf(ps[0]), 0, "nothing pushed");
        assertEq(room.claimable(id, ps[0]), PLAY);
        vm.expectEmit(true, true, false, true);
        emit Room.Claimed(id, ps[0], PLAY);
        vm.prank(ps[0]);
        room.claim(id);
        assertEq(token.balanceOf(ps[0]), PLAY);
        vm.prank(ps[0]);
        vm.expectRevert(Room.NothingToClaim.selector);
        room.claim(id);

        // closing the room must not sweep unclaimed payouts
        vm.prank(host);
        room.closeRoom();
        vm.prank(ps[1]);
        room.claim(id);
        assertEq(token.balanceOf(ps[1]), PLAY + (DEPOSIT - PLAY));
    }

    function test_hostWhoPlaysGetsNoShareOfSeed() public {
        (Room r, string memory c) = _createRoom(PLAY, DEPOSIT, false, true);
        _joinPooled(r, c, host, "Host");
        _joinPooled(r, c, alice, "Alice");
        uint256 id = _commitAndOpen(r, _choice("Q", 0, Room.Rule.SPLIT), 6e18, 30);
        _answer(r, id, host, _opt(0));
        _answer(r, id, alice, _opt(0));
        _warpToLock(r, id);
        _reveal(r, id, host, _opt(0));
        _reveal(r, id, alice, _opt(0));
        _resolve(r, id, _opt(0));
        _warpPastDispute(r, id);
        uint256 hostBefore = token.balanceOf(host);
        r.settle(id);
        assertEq(token.balanceOf(host) - hostBefore, PLAY, "host: half the plays, none of the seed");
        assertEq(token.balanceOf(alice), PLAY + 6e18, "alice: half the plays plus the whole seed");
    }

    function test_hostSoleWinnerGetsSeedBackAsRefund() public {
        (Room r, string memory c) = _createRoom(PLAY, DEPOSIT, false, true);
        _joinPooled(r, c, host, "Host");
        _joinPooled(r, c, alice, "Alice");
        uint256 id = _commitAndOpen(r, _choice("Q", 0, Room.Rule.SPLIT), 6e18, 30);
        _answer(r, id, host, _opt(0));
        _answer(r, id, alice, _opt(1));
        _warpToLock(r, id);
        _reveal(r, id, host, _opt(0));
        _reveal(r, id, alice, _opt(1));
        _resolve(r, id, _opt(0));
        _warpPastDispute(r, id);
        uint256 hostBefore = token.balanceOf(host);
        vm.expectEmit(true, false, false, true);
        emit Room.SeedReturned(id, 6e18);
        r.settle(id);
        assertEq(token.balanceOf(host) - hostBefore, 2 * PLAY + 6e18);
        assertEq(r.dust(), 0);
    }

    // ------------------------------------------------------------------ timeout / close

    function test_voidByTimeoutAfterSilentHost() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 4e18, 30);
        _answer(room, id, alice, _opt(0));
        vm.warp(_lockTime(room, id) + room.HOST_TIMEOUT());
        vm.expectRevert(Room.TooEarly.selector);
        room.voidByTimeout(id);
        vm.warp(block.timestamp + 1);
        vm.prank(bob);
        room.voidByTimeout(id);
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.VOIDED));
        assertEq(_deposit(room, alice), DEPOSIT);
        assertEq(token.balanceOf(host), 4e18);
        vm.expectRevert(Room.WrongStatus.selector);
        room.voidByTimeout(id);
    }

    function test_closeRoomVoidsOpenQuestionRefundsAllAndReturnsBudget() public {
        (Room r, string memory c) = _createRoom(1e18, DEPOSIT, true, false);
        _fundBudget(r, 3 * DEPOSIT);
        _join(r, c, alice, "Alice");
        _join(r, c, bob, "Bob");
        uint256 id = _commitAndOpen(r, _choice("Q", 0, Room.Rule.SPLIT), 5e18, 30);
        _answer(r, id, alice, _opt(0));
        vm.prank(bob);
        r.leave();

        vm.prank(alice);
        vm.expectRevert(Room.NotHost.selector);
        r.closeRoom();

        vm.expectEmit(true, false, false, true);
        emit Room.Voided(id, "room closed");
        vm.expectEmit(true, false, false, true);
        emit Room.Refunded(alice, DEPOSIT);
        vm.expectEmit(false, false, false, true);
        emit Room.RoomClosed(DEPOSIT, DEPOSIT);
        vm.prank(host);
        r.closeRoom();

        assertTrue(r.closed());
        assertEq(token.balanceOf(alice), DEPOSIT, "full deposit back: play refunded then whole balance");
        assertEq(token.balanceOf(bob), DEPOSIT, "left with 19, play refunded directly after");
        assertEq(token.balanceOf(host), DEPOSIT + 5e18, "unused budget for one absent person + seed");
        assertEq(token.balanceOf(address(r)), 0, "nothing stranded");

        vm.prank(carol);
        vm.expectRevert(Room.RoomIsClosed.selector);
        r.join(c, "Carol");
        vm.prank(host);
        vm.expectRevert(Room.RoomIsClosed.selector);
        r.closeRoom();
    }

    function test_closeRoomSettlesResolvedQuestionButNotDuringDispute() public {
        _joinPooled(room, code, alice, "Alice");
        uint256 id = _commitAndOpen(room, _choice("Q", 0, Room.Rule.SPLIT), 0, 30);
        _answer(room, id, alice, _opt(0));
        _warpToLock(room, id);
        _reveal(room, id, alice, _opt(0));
        _resolve(room, id, _opt(0));
        vm.prank(host);
        vm.expectRevert(Room.DisputeWindowOpen.selector);
        room.closeRoom();
        _warpPastDispute(room, id);
        vm.prank(host);
        room.closeRoom();
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.SETTLED));
        assertEq(token.balanceOf(alice), DEPOSIT, "won the pot back plus the rest of the deposit");
    }

    function test_hashHelpersMatchContract() public view {
        Q memory q = _choice("Q", 2, Room.Rule.FASTEST_N);
        assertEq(room.questionHash(q.text, q.options, q.template, q.rule, q.n, q.salt), _hash(q));
        assertEq(room.answerHash(_opt(1), bytes32(uint256(7))), keccak256(abi.encode(_opt(1), bytes32(uint256(7)))));
    }
}
