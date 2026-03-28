import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [], "name": "taskCounter", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
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
    const now = BigInt(Math.floor(Date.now() / 1000));
    const counter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
    
    console.log(`Now: ${now}`);
    for (let i = 1n; i <= counter; i++) {
        const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
        const state = Number(t[12]);
        if (state < 6 && state !== 0) {
            console.log(`Task #${i}: State=${state}, Buyer=${t[0]}, Seller=${t[1]}`);
            console.log(`   BidDeadline: ${t[6]}, TaskDeadline: ${t[5]}, VerifierDeadline: ${t[7]}`);
            if (state === 1 && now > t[6]) console.log(`   🚨 BIDDING OVERDUE (Hanging)`);
            if (state === 3 && now > t[5]) console.log(`   🚨 WORK SUBMITTED BUT OVERDUE? (State 3, check deadlines)`);
            if (state === 4) console.log(`   🚀 APPROVED: Needs Finalize/Reclaim after cool-off`);
            if (state === 5) console.log(`   🚨 DISPUTED: Needs resolution`);
        }
    }
}

main();
