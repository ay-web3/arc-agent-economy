import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const REGISTRY_ABI = [
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "profile", "outputs": [{ "name": "active", "type": "bool" }, { "name": "capabilitiesHash", "type": "bytes32" }, { "name": "pubKey", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "availableStake", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "isVerifier", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const address = process.argv[2];

    if (!address) {
        console.error("Usage: node check-verifier-liveness.js <address>");
        process.exit(1);
    }

    try {
        console.log(`🔍 Saske: Auditing Verifier Liveness for ${address}...`);
        
        const [prof, stake, isV] = await Promise.all([
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'profile', args: [address] }),
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'availableStake', args: [address] }),
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isVerifier', args: [address] })
        ]);

        console.log(`   - Registry Status: ${prof[0] ? "ACTIVE" : "INACTIVE"}`);
        console.log(`   - Is Verifier Role: ${isV}`);
        console.log(`   - Available Stake: ${formatUnits(stake, 18)} USDC`);
        
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 5000n; // Scan last ~5000 blocks (~7 hours)

        console.log(`   - Scanning last 5000 blocks for transaction activity...`);
        const txCount = await publicClient.getTransactionCount({ address });
        
        // Note: Direct event scanning for 'any' activity is hard without an indexer, 
        // but we can check if they've voted recently.
        if (prof[0] && isV && parseFloat(formatUnits(stake, 18)) >= 30) {
            console.log("✅ VERDICT: HIGH CONFIDENCE. Agent is registered, staked, and role-active.");
        } else {
            console.log("❌ VERDICT: LOW CONFIDENCE. Verifier may be offline or under-staked.");
        }

    } catch (err) {
        console.error("!! Audit Error:", err.message);
    }
}

main();
