// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Room} from "./Room.sol";

/// @title RoomFactory
/// @notice Deploys a `Room` per session and hands out a unique 6-character join code.
contract RoomFactory {
    /// @dev 32 unambiguous characters (no 0/O, 1/I): 32^6 ≈ 1.07 billion codes.
    bytes internal constant ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    uint256 internal constant CODE_LENGTH = 6;
    uint256 internal constant MAX_TRIES = 8;

    address[] internal _rooms;
    mapping(bytes32 => address) internal _roomByCode; // keccak256(code) → room
    mapping(address => address[]) internal _roomsByHost;
    uint256 internal _nonce;

    event RoomCreated(
        address indexed room,
        address indexed host,
        string code,
        address token,
        uint128 playPrice,
        uint128 startingDeposit,
        bool sponsored,
        bool hostPlays
    );

    error CodeCollision();
    error UnknownCode();

    /// @notice Create a room hosted by the caller. Returns the room address and its join code.
    function createRoom(Room.Config calldata cfg) external returns (address room, string memory code) {
        code = _newCode();
        room = address(new Room(msg.sender, code, cfg));
        _rooms.push(room);
        _roomByCode[keccak256(bytes(code))] = room;
        _roomsByHost[msg.sender].push(room);
        emit RoomCreated(
            room, msg.sender, code, cfg.token, cfg.playPrice, cfg.startingDeposit, cfg.sponsored, cfg.hostPlays
        );
    }

    function roomByCode(string calldata code) external view returns (address room) {
        room = _roomByCode[keccak256(bytes(code))];
        if (room == address(0)) revert UnknownCode();
    }

    function roomsByHost(address host) external view returns (address[] memory) {
        return _roomsByHost[host];
    }

    function rooms() external view returns (address[] memory) {
        return _rooms;
    }

    function roomCount() external view returns (uint256) {
        return _rooms.length;
    }

    function _newCode() internal returns (string memory) {
        for (uint256 t = 0; t < MAX_TRIES; t++) {
            bytes32 h = keccak256(abi.encode(block.prevrandao, block.timestamp, msg.sender, _nonce++, t));
            bytes memory c = new bytes(CODE_LENGTH);
            for (uint256 i = 0; i < CODE_LENGTH; i++) {
                c[i] = ALPHABET[uint8(h[i]) % ALPHABET.length];
            }
            if (_roomByCode[keccak256(c)] == address(0)) return string(c);
        }
        revert CodeCollision();
    }
}
