// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title KokoToken
/// @notice Mock ERC-20 standing in for a stablecoin on Monad testnet. 1 coin = 1 KOKO (18 decimals).
/// @dev Anyone can mint: this simulates "having a stablecoin to deposit". Testnet only, no real value.
///      Trusts the Kokonad ERC-2771 forwarder so approve/mint can be relayed for accounts without gas.
contract KokoToken is ERC20, ERC2771Context {
    constructor(address forwarder) ERC20("Koko", "KOKO") ERC2771Context(forwarder) {}

    /// @notice Mint `amount` to `to`. Open to everyone on purpose (testnet stand-in).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
