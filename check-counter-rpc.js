import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [], "name": "taskCounter", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    try {
        const count = await publicClient.readContract({
            address: ESCROW_CA,
            abi: ESCROW_ABI,
            functionName: 'taskCounter'
        });
        console.log(`>> Direct RPC Task Counter: ${count}`);
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
