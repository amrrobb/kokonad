// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KokoToken} from "../src/KokoToken.sol";
import {RoomFactory} from "../src/RoomFactory.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @notice Deploys KokoToken and RoomFactory to Monad testnet (chain id 10143).
/// @dev Usage (from contracts/, with .env holding MONAD_TESTNET_RPC and DEPLOYER_PRIVATE_KEY):
///      forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC --broadcast
///      Then copy the printed addresses into deployments/10143.json.
contract Deploy is Script {
    uint256 internal constant MONAD_TESTNET = 10143;

    function run() external {
        require(block.chainid == MONAD_TESTNET, "Deploy: testnet only (chain id 10143)");
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(key);
        // Participants sign requests; the relayer (backend) submits them through this forwarder and pays gas.
        ERC2771Forwarder forwarder = new ERC2771Forwarder("Kokonad");
        KokoToken token = new KokoToken(address(forwarder));
        RoomFactory factory = new RoomFactory(address(forwarder));
        vm.stopBroadcast();

        console.log("chainId      ", block.chainid);
        console.log("Forwarder    ", address(forwarder));
        console.log("KokoToken    ", address(token));
        console.log("RoomFactory  ", address(factory));
        console.log("deployBlock  ", block.number);
    }
}
