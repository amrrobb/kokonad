// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RoomTestBase} from "./RoomTestBase.sol";
import {Room} from "../src/Room.sol";

/// @dev End-to-end lifecycles. Numbers come from PRD §5A, not from this file's assumptions.
contract RoomE2ETest is RoomTestBase {
    address internal A = makeAddr("A");
    address internal B = makeAddr("B");
    address internal C = makeAddr("C");
    address internal D = makeAddr("D");

    // ------------------------------------------------------------------------------------------
    // One question, three participants: one correct, one wrong, one sat out (sponsored room)
    // ------------------------------------------------------------------------------------------

    function test_oneQuestionThreeParticipants() public {
        uint128 play = 2 * uint128(COIN);
        uint128 deposit = 20 * uint128(COIN);
        uint128 seed = 5 * uint128(COIN);

        (Room room, string memory code) = _createRoom(play, deposit, true, false);
        _fundBudget(room, 3 * deposit);
        _join(room, code, A, "Ayu");
        _join(room, code, B, "Bima");
        _join(room, code, C, "Citra");
        assertEq(room.budget(), 0);

        // host seals, then opens: every deposit drops by one play, the pot fills at once
        Q memory q = _choice("Who scores first?", 0, Room.Rule.SPLIT);
        uint256 id = _commit(room, q);
        _open(room, id, q, seed, 30);
        Room.Question memory qq = room.getQuestion(id);
        assertEq(qq.pot, 3 * play + seed, "pot = plays + seed");
        assertEq(qq.charged, 3);
        assertEq(_deposit(room, A), deposit - play);
        assertEq(_deposit(room, B), deposit - play);
        assertEq(_deposit(room, C), deposit - play);
        assertTrue(room.hasAnswerToken(id, C), "C received a play too");

        // A and B answer (Answer burned); C sits out
        _answer(room, id, A, _opt(1));
        _answer(room, id, B, _opt(2));
        assertEq(room.getQuestion(id).answerers, 2);
        assertFalse(room.hasAnswerToken(id, A));
        assertTrue(room.hasAnswerToken(id, C), "unused play until lock");

        // timer over: C's play expires (its coins stay in the pot), reveals come in automatically
        _warpToLock(room, id);
        _reveal(room, id, A, _opt(1));
        _reveal(room, id, B, _opt(2));
        assertEq(room.getQuestion(id).revealed, 2);

        // host sets the result: only A is minted Correct
        _resolve(room, id, _opt(1));
        assertTrue(room.hasCorrectToken(id, A));
        assertFalse(room.hasCorrectToken(id, B));
        assertFalse(room.hasCorrectToken(id, C));
        assertEq(_correctTotal(room, A), 1);

        // dispute window passes, anyone settles: the whole pot goes to A's balance
        _warpPastDispute(room, id);
        vm.prank(D);
        room.settle(id);
        assertEq(token.balanceOf(A), 3 * play + seed, "A wins C's forfeited play and B's wrong play plus the seed");
        assertEq(token.balanceOf(B), 0);
        assertEq(token.balanceOf(C), 0);
        assertEq(uint8(room.getQuestion(id).status), uint8(Room.Status.SETTLED));

        // close: remaining deposits go back, nobody is punished for a short session
        vm.prank(host);
        room.closeRoom();
        assertEq(token.balanceOf(A), 3 * play + seed + (deposit - play));
        assertEq(token.balanceOf(B), deposit - play);
        assertEq(token.balanceOf(C), deposit - play);
        assertEq(token.balanceOf(host), 0, "budget fully used, seed paid out");
        assertEq(token.balanceOf(address(room)), 0, "nothing stranded");
        assertEq(token.balanceOf(A) + token.balanceOf(B) + token.balanceOf(C), 3 * deposit + seed, "conservation");
    }

    // ------------------------------------------------------------------------------------------
    // PRD §5A worked example: pooled, 4 people, deposit 20, play 2, 10 questions, seed 6 on Q8.
    // A right 8×, B right 4×, C leaves after Q5 (right 3×), D never answers, Q7 nobody right.
    // ------------------------------------------------------------------------------------------

    Room internal room;
    string internal code;
    uint128 internal constant PLAY = 2e18;
    uint128 internal constant DEPOSIT = 20e18;

    /// @dev Runs one question: `answers[i]` is the option chosen by `who[i]` (everyone else sits out).
    function _round(uint256 n, address[] memory who, uint256[] memory answers, uint256 outcome, uint128 seed)
        internal
        returns (uint256 id)
    {
        Q memory q = _choice(string(abi.encodePacked("Q", n)), 0, Room.Rule.SPLIT);
        id = _commitAndOpen(room, q, seed, 30);
        for (uint256 i = 0; i < who.length; i++) {
            _answer(room, id, who[i], _opt(answers[i]));
        }
        _warpToLock(room, id);
        for (uint256 i = 0; i < who.length; i++) {
            _reveal(room, id, who[i], _opt(answers[i]));
        }
        vm.warp(room.getQuestion(id).revealUntil + 1);
        _resolve(room, id, _opt(outcome));
        if (room.getQuestion(id).status == Room.Status.RESOLVED) {
            _warpPastDispute(room, id);
            room.settle(id);
        }
    }

    function _who(address a, address b, address c) internal pure returns (address[] memory w) {
        uint256 n = c != address(0) ? 3 : 2;
        w = new address[](n);
        w[0] = a;
        w[1] = b;
        if (n == 3) w[2] = c;
    }

    function _ans3(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory r) {
        r = new uint256[](3);
        r[0] = a;
        r[1] = b;
        r[2] = c;
    }

    function _ans2(uint256 a, uint256 b) internal pure returns (uint256[] memory r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }

    function test_prdWorkedExample() public {
        (room, code) = _createRoom(PLAY, DEPOSIT, false, false);
        _joinPooled(room, code, A, "A");
        _joinPooled(room, code, B, "B");
        _joinPooled(room, code, C, "C");
        _joinPooled(room, code, D, "D");
        assertEq(token.balanceOf(address(room)), 4 * DEPOSIT, "deposits 80");

        uint256 RIGHT = 0;
        uint256 WRONG = 1;

        // Q1–Q5: 4 charged, pot 8. D's play expires every time.
        uint256 q1 = _round(1, _who(A, B, C), _ans3(RIGHT, RIGHT, RIGHT), RIGHT, 0); // 8/3 each
        assertEq(room.getQuestion(q1).pot, 8e18);
        assertEq(room.getQuestion(q1).charged, 4);
        _round(2, _who(A, B, C), _ans3(RIGHT, WRONG, RIGHT), RIGHT, 0); // A, C: 4 each
        _round(3, _who(A, B, C), _ans3(RIGHT, RIGHT, WRONG), RIGHT, 0); // A, B: 4 each
        _round(4, _who(A, B, C), _ans3(RIGHT, WRONG, RIGHT), RIGHT, 0); // A, C: 4 each
        _round(5, _who(A, B, C), _ans3(RIGHT, RIGHT, WRONG), RIGHT, 0); // A, B: 4 each

        // C leaves after Q5 with the 10 coins never played
        assertEq(_deposit(room, C), DEPOSIT - 5 * PLAY);
        vm.prank(C);
        room.leave();
        assertEq(_correctTotal(room, C), 3);

        // Q6–Q10: 3 charged, pot 6
        uint256 q6 = _round(6, _who(A, B, address(0)), _ans2(WRONG, RIGHT), RIGHT, 0); // B: 6
        assertEq(room.getQuestion(q6).pot, 6e18);
        assertEq(room.getQuestion(q6).charged, 3);

        // Q7: nobody right → the 2 coins go back to all three, including D who sat out
        uint128 aBefore = _deposit(room, A);
        uint128 dBefore = _deposit(room, D);
        uint256 q7 = _round(7, _who(A, B, address(0)), _ans2(WRONG, WRONG), RIGHT, 0);
        assertEq(uint8(room.getQuestion(q7).status), uint8(Room.Status.VOIDED));
        assertEq(_deposit(room, A), aBefore, "A's play refunded");
        assertEq(_deposit(room, D), dBefore, "D's play refunded");

        // Q8: seed 6 → pot 12, A alone
        uint256 q8 = _round(8, _who(A, B, address(0)), _ans2(RIGHT, WRONG), RIGHT, 6e18);
        assertEq(room.getQuestion(q8).pot, 12e18);
        _round(9, _who(A, B, address(0)), _ans2(RIGHT, WRONG), RIGHT, 0); // A: 6
        _round(10, _who(A, B, address(0)), _ans2(RIGHT, WRONG), RIGHT, 0); // A: 6

        // Correct counts
        assertEq(_correctTotal(room, A), 8);
        assertEq(_correctTotal(room, B), 4);
        assertEq(_correctTotal(room, C), 3);
        assertEq(_correctTotal(room, D), 0);

        // "won" is what left the room as payouts; C's wallet also holds the 10 refunded at leave
        uint256 tol = 10; // wei of rounding across 8/3 splits
        assertApproxEqAbs(token.balanceOf(A), 42.67e18, 0.01e18, "A won 42.67");
        assertApproxEqAbs(token.balanceOf(B), 16.67e18, 0.01e18, "B won 16.67");
        assertApproxEqAbs(token.balanceOf(C) - 10e18, 10.67e18, 0.01e18, "C won 10.67");
        assertEq(token.balanceOf(D), 0, "D won 0");
        // exact: Q1 floor(8/3); the 2 wei of Q1 dust rolled into Q2's pot and split 2 ways (+1 wei each)
        assertEq(token.balanceOf(A), 40e18 + uint256(8e18) / 3 + 1, "A exact, dust rolled into Q2");
        assertEq(token.balanceOf(C) - 10e18, 8e18 + uint256(8e18) / 3 + 1, "C exact, dust rolled into Q2");

        // charged: A 18, B 18, C 10, D 18 → remaining deposits 2, 2, (left), 2
        assertEq(_deposit(room, A), 2e18);
        assertEq(_deposit(room, B), 2e18);
        assertEq(_deposit(room, D), 2e18);

        // close: deposits refunded, dust to host
        vm.prank(host);
        room.closeRoom();
        assertApproxEqAbs(token.balanceOf(A), 44.67e18, 0.01e18, "A final 44.67 (+24.67)");
        assertApproxEqAbs(token.balanceOf(B), 18.67e18, 0.01e18, "B final 18.67 (-1.33)");
        assertApproxEqAbs(token.balanceOf(C), 20.67e18, 0.01e18, "C final 20.67 (+0.67)");
        assertEq(token.balanceOf(D), 2e18, "D final 2 (-18)");

        // Paid out 86 = deposits 80 + seed 6, to the wei once the host's dust is counted
        uint256 participantsTotal = token.balanceOf(A) + token.balanceOf(B) + token.balanceOf(C) + token.balanceOf(D);
        assertApproxEqAbs(participantsTotal, 86e18, tol);
        assertEq(participantsTotal + token.balanceOf(host), 86e18, "conservation to the wei");
        assertEq(token.balanceOf(address(room)), 0, "nothing stranded in the room");
    }
}
