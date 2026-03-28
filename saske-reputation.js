import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const REPUTATION_ABI = [
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "getReputation", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const address = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

    console.log(`🔍 Saske: Querying ARC Reputation Registry...`);

    try {
        const score = await publicClient.readContract({
            address: REPUTATION_REGISTRY,
            abi: REPUTATION_ABI,
            functionName: 'getReputation',
            args: [address]
        });

        console.log(`>> Agent Wallet: ${address}`);
        console.log(`>> Global Reputation Score: ${score}`);
        
        if (Number(score) === 0) {
            console.log(">> Status: New Agent. No history yet.");
        } else {
            console.log(">> Status: Active record found.");
        }

    } catch (err) {
        // Fallback for demo if contract is not yet fully deployed or formatted differently
        console.log(">> Registry Query failed. The Reputation standard (ERC-8004) is likely in early testing phase.");
    }
}

main();
