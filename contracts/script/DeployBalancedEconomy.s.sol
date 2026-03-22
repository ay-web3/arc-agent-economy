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
        // Min Seller Stake: 50 USDC (18 decimals for ARC Testnet native)
        // Min Verifier Stake: 20 USDC
        // Withdraw Cooldown: 24 Hours
        AgentRegistry registry = new AgentRegistry(
            deployer,
            50 ether,
            20 ether,
            86400
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

        vm.stopBroadcast();

        console2.log("=== DEPLOYMENT SUCCESSFUL ===");
        console2.log("AgentRegistry:", address(registry));
        console2.log("TaskEscrow:", address(escrow));
        console2.log("Admin/Treasury:", deployer);
    }
}
