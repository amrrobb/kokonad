// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title KokoToken
/// @notice Mock ERC-20 standing in for a stablecoin on Monad testnet. 1 coin = 1 KOKO (18 decimals).
/// @dev Anyone can mint: this simulates "having a stablecoin to deposit". Testnet only, no real value.
contract KokoToken is ERC20 {
    constructor() ERC20("Koko", "KOKO") {}

    /// @notice Mint `amount` to `to`. Open to everyone on purpose (testnet stand-in).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
