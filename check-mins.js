import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const REGISTRY_ABI = [
  { "inputs": [], "name": "minSellerStake", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "minVerifierStake", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const minSeller = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'minSellerStake' });
        const minVerifier = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'minVerifierStake' });

        console.log(`>> Min Seller Stake: ${formatUnits(minSeller, 18)} USDC`);
        console.log(`>> Min Verifier Stake: ${formatUnits(minVerifier, 18)} USDC`);

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
