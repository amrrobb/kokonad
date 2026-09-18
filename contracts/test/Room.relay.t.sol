// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {Room} from "../src/Room.sol";
import {RoomFactory} from "../src/RoomFactory.sol";
import {RoomTestBase} from "./RoomTestBase.sol";

/// @notice Participants and hosts on Monad cannot send transactions until they hold the 10 MON reserve,
///         so every player action goes through the ERC-2771 forwarder: the player signs, a relayer pays.
///         These tests prove the signer, never the relayer, is who the contracts credit.
contract RoomRelayTest is RoomTestBase {
    bytes32 internal constant REQUEST_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    address internal relayer = makeAddr("relayer");
    uint256 internal aliceKey = 0xA11CE;
    uint256 internal bobKey = 0xB0B;
    uint256 internal hostKey = 0x4057;
    address internal alice;
    address internal bob;

    function setUp() public override {
        super.setUp();
        alice = vm.addr(aliceKey);
        bob = vm.addr(bobKey);
        vm.deal(relayer, 100 ether);
        // Players hold no gas at all.
        assertEq(alice.balance, 0);
        assertEq(bob.balance, 0);
    }

    function _request(uint256 key, address to, bytes memory data)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory req)
    {
        return _requestWithGas(key, to, data, 1_000_000);
    }

    function _requestWithGas(uint256 key, address to, bytes memory data, uint256 gas)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory req)
    {
        address from = vm.addr(key);
        req = ERC2771Forwarder.ForwardRequestData({
            from: from,
            to: to,
            value: 0,
            gas: gas,
            deadline: uint48(block.timestamp + 1 hours),
            data: data,
            signature: ""
        });
        req.signature = _sign(key, req, forwarder.nonces(from));
    }

    function _sign(uint256 key, ERC2771Forwarder.ForwardRequestData memory req, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Kokonad"), keccak256("1"), block.chainid, address(forwarder))
        );
        bytes32 structHash = keccak256(
            abi.encode(REQUEST_TYPEHASH, req.from, req.to, req.value, req.gas, nonce, req.deadline, keccak256(req.data))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _relay(ERC2771Forwarder.ForwardRequestData memory req) internal {
        vm.prank(relayer);
        forwarder.execute(req);
    }

    function _sponsoredRoom() internal returns (Room room, string memory code) {
        (room, code) = _createRoom(1e18, 20e18, true, false);
        _fundBudget(room, 200e18);
    }

    function test_relayedJoinCreditsTheSignerNotTheRelayer() public {
        (Room room, string memory code) = _sponsoredRoom();

        vm.expectEmit(true, false, false, true, address(room));
        emit Room.Joined(alice, "Alice", 20e18);
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice"))));

        assertTrue(room.joined(alice));
        assertFalse(room.joined(relayer));
        assertFalse(room.joined(address(forwarder)));
        assertEq(_deposit(room, alice), 20e18);
        assertEq(alice.balance, 0, "player paid nothing");
    }

    function test_forgedRequestIsRejected() public {
        (Room room, string memory code) = _sponsoredRoom();
        // Signed by Alice, but claims to come from Bob.
        ERC2771Forwarder.ForwardRequestData memory req =
            _request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Bob")));
        req.from = bob;
        vm.prank(relayer);
        // Recovery over the altered request yields some address other than Bob, so the forwarder refuses.
        vm.expectPartialRevert(ERC2771Forwarder.ERC2771ForwarderInvalidSigner.selector);
        forwarder.execute(req);
        assertFalse(room.joined(bob));
    }

    function test_tamperedDataIsRejected() public {
        (Room room, string memory code) = _sponsoredRoom();
        ERC2771Forwarder.ForwardRequestData memory req =
            _request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice")));
        req.data = abi.encodeCall(Room.join, (code, "Mallory")); // relayer edits the payload
        vm.prank(relayer);
        vm.expectRevert();
        forwarder.execute(req);
        assertFalse(room.joined(alice));
    }

    function test_replayIsRejected() public {
        (Room room, string memory code) = _sponsoredRoom();
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice"))));
        ERC2771Forwarder.ForwardRequestData memory req =
            _request(aliceKey, address(room), abi.encodeCall(Room.leave, ()));
        _relay(req);
        assertTrue(forwarder.nonces(alice) == 2);
        // Same signed request again: its nonce is spent.
        vm.prank(relayer);
        vm.expectPartialRevert(ERC2771Forwarder.ERC2771ForwarderInvalidSigner.selector);
        forwarder.execute(req);
    }

    function test_expiredRequestIsRejected() public {
        (Room room, string memory code) = _sponsoredRoom();
        ERC2771Forwarder.ForwardRequestData memory req =
            _request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice")));
        vm.warp(block.timestamp + 2 hours);
        vm.prank(relayer);
        vm.expectPartialRevert(ERC2771Forwarder.ERC2771ForwarderExpiredRequest.selector);
        forwarder.execute(req);
        assertFalse(room.joined(alice));
    }

    function test_relayedCreateRoomMakesTheSignerHost() public {
        address hostSigner = vm.addr(hostKey);
        Room.Config memory cfg = Room.Config({
            token: address(token), playPrice: 1e18, startingDeposit: 20e18, sponsored: true, hostPlays: false
        });
        vm.recordLogs();
        // Deploying a Room is heavy; the relayer must forward enough gas for it.
        _relay(_requestWithGas(hostKey, address(factory), abi.encodeCall(RoomFactory.createRoom, (cfg)), 10_000_000));
        address[] memory mine = factory.roomsByHost(hostSigner);
        assertEq(mine.length, 1);
        assertEq(Room(mine[0]).host(), hostSigner);
        assertEq(factory.roomsByHost(relayer).length, 0);
        assertTrue(Room(mine[0]).isTrustedForwarder(address(forwarder)), "rooms inherit the forwarder");
    }

    function test_relayedAnswerAndRevealCountForTheSigner() public {
        (Room room, string memory code) = _sponsoredRoom();
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice"))));
        _relay(_request(bobKey, address(room), abi.encodeCall(Room.join, (code, "Bob"))));

        Q memory q = _choice("Which one?", 0, Room.Rule.SPLIT);
        uint256 id = _commitAndOpen(room, q, 0, 60);

        bytes32 aSalt = _salt(alice, id);
        bytes32 bSalt = _salt(bob, id);
        _relay(
            _request(
                aliceKey, address(room), abi.encodeCall(Room.commitAnswer, (id, keccak256(abi.encode(_opt(1), aSalt))))
            )
        );
        _relay(
            _request(
                bobKey, address(room), abi.encodeCall(Room.commitAnswer, (id, keccak256(abi.encode(_opt(2), bSalt))))
            )
        );
        _warpToLock(room, id);
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.revealAnswer, (id, _opt(1), aSalt))));
        _relay(_request(bobKey, address(room), abi.encodeCall(Room.revealAnswer, (id, _opt(2), bSalt))));
        _resolve(room, id, _opt(1));

        assertTrue(room.hasCorrectToken(id, alice));
        assertFalse(room.hasCorrectToken(id, bob));
        assertFalse(room.hasCorrectToken(id, relayer));
        assertEq(_correctTotal(room, alice), 1);
    }

    function test_pooledRoomMintApproveJoinAllRelayed() public {
        (Room room, string memory code) = _createRoom(1e18, 20e18, false, false);
        _relay(_request(aliceKey, address(token), abi.encodeWithSignature("mint(address,uint256)", alice, 20e18)));
        _relay(
            _request(
                aliceKey, address(token), abi.encodeWithSignature("approve(address,uint256)", address(room), 20e18)
            )
        );
        assertEq(token.allowance(alice, address(room)), 20e18, "approval recorded for the signer");
        assertEq(token.allowance(relayer, address(room)), 0);
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice"))));
        assertEq(_deposit(room, alice), 20e18);
        assertEq(token.balanceOf(alice), 0);
        assertEq(alice.balance, 0);
    }

    function test_sessionKeyCannotBeTakenOverByAnotherParticipant() public {
        (Room room, string memory code) = _sponsoredRoom();
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.join, (code, "Alice"))));
        _relay(_request(bobKey, address(room), abi.encodeCall(Room.join, (code, "Bob"))));
        address key = makeAddr("aliceSessionKey");
        uint64 expiry = uint64(block.timestamp + 1 days);
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.registerSessionKey, (key, expiry))));
        assertEq(room.sessionKeyOwner(key), alice);

        // Bob tries to re-point Alice's key at himself.
        ERC2771Forwarder.ForwardRequestData memory req =
            _request(bobKey, address(room), abi.encodeCall(Room.registerSessionKey, (key, expiry)));
        // The forwarder reports inner reverts as FailedCall; the direct call below pins the reason.
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSignature("FailedCall()"));
        forwarder.execute(req);
        vm.prank(bob);
        vm.expectRevert(Room.SessionKeyTaken.selector);
        room.registerSessionKey(key, expiry);
        assertEq(room.sessionKeyOwner(key), alice, "key still acts for Alice");

        // Alice can still renew her own key.
        _relay(_request(aliceKey, address(room), abi.encodeCall(Room.registerSessionKey, (key, expiry + 1))));
        assertEq(room.sessionKeyExpiry(key), expiry + 1);
    }
}
