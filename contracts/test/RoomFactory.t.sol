// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RoomTestBase} from "./RoomTestBase.sol";
import {Room} from "../src/Room.sol";
import {RoomFactory} from "../src/RoomFactory.sol";

contract RoomFactoryTest is RoomTestBase {
    function test_createRoomRegistersAndEmits() public {
        vm.expectEmit(false, true, false, false);
        emit RoomFactory.RoomCreated(address(0), host, "", address(token), 2e18, 20e18, false, false);
        (Room room, string memory code) = _createRoom(2e18, 20e18, false, false);

        assertEq(room.host(), host);
        assertEq(room.factory(), address(factory));
        assertEq(address(room.token()), address(token));
        assertEq(room.playPrice(), 2e18);
        assertEq(room.startingDeposit(), 20e18);
        assertEq(room.sponsored(), false);
        assertEq(room.hostPlays(), false);
        assertEq(room.code(), code);

        assertEq(factory.roomByCode(code), address(room));
        assertEq(factory.roomCount(), 1);
        assertEq(factory.rooms()[0], address(room));
        assertEq(factory.roomsByHost(host)[0], address(room));
    }

    function test_codeIsSixUnambiguousChars() public {
        (, string memory code) = _createRoom(1e18, 20e18, true, false);
        bytes memory b = bytes(code);
        assertEq(b.length, 6);
        for (uint256 i = 0; i < 6; i++) {
            bytes1 c = b[i];
            bool upper = c >= "A" && c <= "Z";
            bool digit = c >= "2" && c <= "9";
            assertTrue(upper || digit, "code char");
            assertTrue(c != "O" && c != "I", "ambiguous char");
        }
    }

    function test_codesAreUniqueAcrossRooms() public {
        uint256 n = 25;
        bytes32[] memory seen = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            (, string memory code) = _createRoom(1e18, 20e18, true, false);
            bytes32 h = keccak256(bytes(code));
            for (uint256 j = 0; j < i; j++) {
                assertTrue(seen[j] != h, "duplicate code");
            }
            seen[i] = h;
        }
        assertEq(factory.roomCount(), n);
    }

    function test_unknownCodeReverts() public {
        vm.expectRevert(RoomFactory.UnknownCode.selector);
        factory.roomByCode("ZZZZZZ");
    }

    function test_invalidConfigReverts() public {
        vm.prank(host);
        vm.expectRevert(Room.BadQuestion.selector);
        factory.createRoom(
            Room.Config({token: address(0), playPrice: 1, startingDeposit: 1, sponsored: true, hostPlays: false})
        );
        vm.prank(host);
        vm.expectRevert(Room.BadQuestion.selector);
        factory.createRoom(
            Room.Config({token: address(token), playPrice: 1, startingDeposit: 0, sponsored: true, hostPlays: false})
        );
    }
}
