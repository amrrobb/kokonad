// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KokoToken} from "../src/KokoToken.sol";

contract KokoTokenTest is Test {
    KokoToken internal token;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        token = new KokoToken(address(0xF0));
    }

    function test_metadata() public view {
        assertEq(token.name(), "Koko");
        assertEq(token.symbol(), "KOKO");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
    }

    function test_anyoneCanMint() public {
        vm.prank(alice);
        token.mint(bob, 20e18);
        assertEq(token.balanceOf(bob), 20e18);
        assertEq(token.totalSupply(), 20e18);
    }

    function test_transferAndApprove() public {
        token.mint(alice, 5e18);
        vm.prank(alice);
        token.approve(bob, 3e18);
        vm.prank(bob);
        token.transferFrom(alice, bob, 3e18);
        assertEq(token.balanceOf(alice), 2e18);
        assertEq(token.balanceOf(bob), 3e18);
    }

    function testFuzz_mint(address to, uint128 amount) public {
        vm.assume(to != address(0));
        token.mint(to, amount);
        assertEq(token.balanceOf(to), amount);
    }
}
