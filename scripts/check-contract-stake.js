import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const client = createPublicClient({ chain: arcTestnet, transport: http() });
const REGISTRY_CA = "0xB2332698FF627c8CD9298Df4dF2002C4c5562862";

async function checkStake() {
    try {
        const minSeller = await client.readContract({
            address: REGISTRY_CA,
            abi: [{ "inputs": [], "name": "minSellerStake", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }],
            functionName: "minSellerStake"
        });
        
        const minVerifier = await client.readContract({
            address: REGISTRY_CA,
            abi: [{ "inputs": [], "name": "minVerifierStake", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }],
            functionName: "minVerifierStake"
        });
        
        console.log(`\n🔍 BLOCKCHAIN TRUTH:`);
        console.log(`minSellerStake: ${minSeller.toString()} base units`);
        console.log(`minVerifierStake: ${minVerifier.toString()} base units\n`);
    } catch (e) {
        console.error("Failed to read contract:", e.message);
    }
}

checkStake();
