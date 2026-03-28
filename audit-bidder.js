import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const REGISTRY_ABI = [
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "profile", "outputs": [{ "name": "active", "type": "bool" }, { "name": "capabilitiesHash", "type": "bytes32" }, { "name": "pubKey", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "stakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const agentAddress = process.argv[2];

    if (!agentAddress) {
        console.error("Usage: node audit-bidder.js <address>");
        process.exit(1);
    }

    try {
        console.log(`⚔️ Saske: Auditing Potential Worker ${agentAddress}...`);
        
        const [prof, stake] = await Promise.all([
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'profile', args: [agentAddress] }),
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'stakeOf', args: [agentAddress] })
        ]);

        console.log(`   - Active: ${prof[0]}`);
        console.log(`   - Stake: ${formatUnits(stake, 18)} USDC`);
        console.log(`   - Capabilities Hash: ${prof[1]}`);
        
        // Qualification Logic
        if (prof[0] && parseFloat(formatUnits(stake, 18)) >= 50) {
            console.log("✅ STATUS: QUALIFIED. High collateral and active registration.");
        } else {
            console.log("❌ STATUS: UNTRUSTED. Low stake or inactive profile.");
        }

    } catch (err) {
        console.error("!! Audit Error:", err.message);
    }
}

main();
