import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [
      { "name": "buyer", "type": "address" },
      { "name": "seller", "type": "address" },
      { "name": "price", "type": "uint256" },
      { "name": "verifierPool", "type": "uint256" },
      { "name": "sellerBudget", "type": "uint256" },
      { "name": "deadline", "type": "uint64" },
      { "name": "bidDeadline", "type": "uint64" },
      { "name": "verifierDeadline", "type": "uint64" },
      { "name": "approvalTimestamp", "type": "uint64" },
      { "name": "taskHash", "type": "bytes32" },
      { "name": "resultHash", "type": "bytes32" },
      { "name": "resultURI", "type": "string" },
      { "name": "state", "type": "uint8" },
      { "name": "quorumM", "type": "uint8" },
      { "name": "quorumN", "type": "uint8" }
    ], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = 1n;

    try {
        const task = await publicClient.readContract({
            address: ESCROW_CA,
            abi: ESCROW_ABI,
            functionName: 'tasks',
            args: [taskId]
        });

        const now = Math.floor(Date.now() / 1000);
        console.log(`⚔️ Saske: Detailed Audit of Task #${taskId}`);
        console.log(`   - State: ${task[12]}`);
        console.log(`   - Bid Deadline: ${task[6]} (Now: ${now})`);
        console.log(`   - Time Left: ${Number(task[6]) - now} seconds`);
        
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
