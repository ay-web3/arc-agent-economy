import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "name": "buyer", "type": "address" }, { "name": "seller", "type": "address" }, { "name": "price", "type": "uint256" }, { "name": "verifierPool", "type": "uint256" }, { "name": "sellerBudget", "type": "uint256" }, { "name": "deadline", "type": "uint64" }, { "name": "bidDeadline", "type": "uint64" }, { "name": "verifierDeadline", "type": "uint64" }, { "name": "approvalTimestamp", "type": "uint64" }, { "name": "taskHash", "type": "bytes32" }, { "name": "resultHash", "type": "bytes32" }, { "name": "resultURI", "type": "string" }, { "name": "state", "type": "uint8" }, { "name": "quorumM", "type": "uint8" }, { "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const states = ["NONE", "CREATED", "ACCEPTED", "SUBMITTED", "QUORUM_APPROVED", "REJECTED", "FINALIZED", "TIMEOUT_REFUNDED", "DISPUTED", "RESOLVED"];

    console.log("🦅 Saske: Scanning for ALL new tasks...");

    for (let i = 1n; i <= 100n; i++) {
        try {
            const task = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
            if (task[12] === 0) continue; // NONE state
            
            const stateStr = states[task[12]];
            console.log(`Task #${i}: State=${stateStr}, Buyer=${task[0]}, Seller=${task[1]}`);
            if (task[12] === 1) { // CREATED
                console.log(`   Bid Deadline: ${task[6]} (Now: ${Math.floor(Date.now() / 1000)})`);
            }
        } catch (err) {
            // Probably end of tasks
            break;
        }
    }
}

main();
