// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KokoToken} from "../src/KokoToken.sol";
import {Room} from "../src/Room.sol";
import {RoomFactory} from "../src/RoomFactory.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @dev Shared fixtures: token, factory, a host, and helpers that mirror what the clients will do.
abstract contract RoomTestBase is Test {
    uint256 internal constant COIN = 1e18;

    ERC2771Forwarder internal forwarder;
    KokoToken internal token;
    RoomFactory internal factory;
    address internal host = makeAddr("host");
    string[] internal noOptions;

    function setUp() public virtual {
        forwarder = new ERC2771Forwarder("Kokonad");
        token = new KokoToken(address(forwarder));
        factory = new RoomFactory(address(forwarder));
    }

    function _createRoom(uint128 playPrice, uint128 startingDeposit, bool sponsored, bool hostPlays)
        internal
        returns (Room room, string memory code)
    {
        vm.prank(host);
        (address addr, string memory c) = factory.createRoom(
            Room.Config({
                token: address(token),
                playPrice: playPrice,
                startingDeposit: startingDeposit,
                sponsored: sponsored,
                hostPlays: hostPlays
            })
        );
        return (Room(addr), c);
    }

    function _fund(address who, address spender, uint256 amount) internal {
        token.mint(who, amount);
        vm.prank(who);
        token.approve(spender, amount);
    }

    function _join(Room room, string memory code, address who, string memory name) internal {
        vm.prank(who);
        room.join(code, name);
    }

    function _joinPooled(Room room, string memory code, address who, string memory name) internal {
        _fund(who, address(room), room.startingDeposit());
        _join(room, code, who, name);
    }

    function _fundBudget(Room room, uint128 amount) internal {
        _fund(host, address(room), amount);
        vm.prank(host);
        room.fundBudget(amount);
    }

    struct Q {
        string text;
        string[] options;
        Room.Template template;
        Room.Rule rule;
        uint8 n;
        bytes32 salt;
    }

    function _choice(string memory text, uint8 n, Room.Rule rule) internal pure returns (Q memory q) {
        string[] memory opts = new string[](3);
        opts[0] = "A";
        opts[1] = "B";
        opts[2] = "C";
        q = Q(text, opts, Room.Template.CHOICE, rule, n, keccak256(bytes(text)));
    }

    function _numeric(string memory text, Room.Template t) internal pure returns (Q memory q) {
        q = Q(text, new string[](0), t, Room.Rule.SPLIT, 0, keccak256(bytes(text)));
    }

    function _hash(Q memory q) internal pure returns (bytes32) {
        return keccak256(abi.encode(q.text, q.options, q.template, q.rule, q.n, q.salt));
    }

    function _commit(Room room, Q memory q) internal returns (uint256 id) {
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = _hash(q);
        id = room.questionCount();
        vm.prank(host);
        room.commitQuestions(hashes);
    }

    function _open(Room room, uint256 id, Q memory q, uint128 seed, uint32 timer) internal {
        if (seed > 0) _fund(host, address(room), seed);
        vm.prank(host);
        room.openQuestion(id, q.text, q.options, q.template, q.rule, q.n, q.salt, seed, timer);
    }

    function _commitAndOpen(Room room, Q memory q, uint128 seed, uint32 timer) internal returns (uint256 id) {
        id = _commit(room, q);
        _open(room, id, q, seed, timer);
    }

    function _salt(address who, uint256 id) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", who, id));
    }

    function _answer(Room room, uint256 id, address who, bytes32 answer) internal {
        vm.prank(who);
        room.commitAnswer(id, keccak256(abi.encode(answer, _salt(who, id))));
    }

    function _reveal(Room room, uint256 id, address who, bytes32 answer) internal {
        vm.prank(who);
        room.revealAnswer(id, answer, _salt(who, id));
    }

    function _resolve(Room room, uint256 id, bytes32 outcome) internal {
        vm.prank(host);
        room.resolve(id, outcome);
    }

    function _lockTime(Room room, uint256 id) internal view returns (uint64) {
        return room.getQuestion(id).lockAt;
    }

    function _warpToLock(Room room, uint256 id) internal {
        vm.warp(_lockTime(room, id));
    }

    function _warpPastDispute(Room room, uint256 id) internal {
        vm.warp(room.getQuestion(id).disputeUntil + 1);
    }

    function _num(int256 v) internal pure returns (bytes32) {
        return bytes32(uint256(v));
    }

    function _opt(uint256 i) internal pure returns (bytes32) {
        return bytes32(i);
    }

    function _deposit(Room room, address who) internal view returns (uint128 d) {
        (d,,) = room.participants(who);
    }

    function _correctTotal(Room room, address who) internal view returns (uint32 c) {
        (,, c) = room.participants(who);
    }
}
