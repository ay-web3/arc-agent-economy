import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const REGISTRY_ABI = [
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "stakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    try {
        const stake = await publicClient.readContract({
            address: REGISTRY_CA,
            abi: REGISTRY_ABI,
            functionName: 'stakeOf',
            args: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"]
        });
        console.log(`>> Registry Stake Balance: ${formatUnits(stake, 18)} USDC`);
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
