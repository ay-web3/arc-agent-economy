import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const REGISTRY_ABI = [
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "isSeller", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "isVerifier", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "availableStake", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const address = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

    try {
        const [isS, isV, stake] = await Promise.all([
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isSeller', args: [address] }),
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isVerifier', args: [address] }),
            publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'availableStake', args: [address] })
        ]);

        console.log(`🦅 Saske Registry Audit:`);
        console.log(`   - Is Seller: ${isS}`);
        console.log(`   - Is Verifier: ${isV}`);
        console.log(`   - Available Stake: ${stake} (Must be >= 50000000000000000000)`);

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
