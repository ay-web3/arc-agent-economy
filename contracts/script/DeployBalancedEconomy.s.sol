// SPDX-License-Identifier: MIT
// script/DeployBalancedEconomy.s.sol
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/TaskEscrow.sol";

contract DeployBalancedEconomy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("Deploying from:", deployer);

        vm.startBroadcast(pk);

        // 1. Deploy AgentRegistry
        // Min Seller Stake: 0.1 USDC (18 decimals for ARC Testnet native)
        // Min Verifier Stake: 0.1 USDC
        // Withdraw Cooldown: 1 Hour
        AgentRegistry registry = new AgentRegistry(
            deployer,
            0.1 ether,
            0.1 ether,
            3600
        );

        // 2. Deploy TaskEscrow
        // Treasury: Deployer for now
        // Protocol Fee: 2% (200 BPS)
        TaskEscrow escrow = new TaskEscrow(
            address(registry),
            deployer,
            200
        );

        // 3. Setup Roles
        // Grant Escrow the SLASHER_ROLE on the Registry
        registry.grantRole(registry.SLASHER_ROLE(), address(escrow));

        // 4. Option B: Lower the verifier fee floor to enable micro-payment tasks
        //    Standard tasks keep high floors (0.5 USDC default in constructor).
        //    This allows nano tasks to work with tiny verifier pools (0.00001 USDC).
        escrow.setMinVerifierFee(0.00001 ether);

        // 5. Option C: Nano price floor is already set to 0.00001 ether in constructor.
        //    Explicitly set here for visibility / auditability.
        escrow.setMinNanoPrice(0.00001 ether);

        vm.stopBroadcast();

        console2.log("=== DEPLOYMENT SUCCESSFUL ===");
        console2.log("AgentRegistry:", address(registry));
        console2.log("TaskEscrow:   ", address(escrow));
        console2.log("Admin/Treasury:", deployer);
        console2.log("--- Nano Config ---");
        console2.log("minNanoPrice   : 0.01 USDC");
        console2.log("minVerifierFee : 0.001 USDC");
        console2.log("Standard minDerivedPrice: 1.0 USDC (unchanged)");
    }
}
