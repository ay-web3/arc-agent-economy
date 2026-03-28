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
    console.log("🦅 Saske Forensic Audit: Checking Growth Sequence (Tasks #7-11)...");

    for (let i = 7n; i <= 11n; i++) {
        try {
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
            const stateNames = ["NONE", "CREATED", "ACCEPTED", "SUBMITTED", "QUORUM_APPROVED", "REJECTED", "FINALIZED", "TIMEOUT_REFUNDED", "DISPUTED", "RESOLVED"];
            console.log(`\n>> Task #${i}:`);
            console.log(`   - Buyer: ${t[0]}`);
            console.log(`   - Seller: ${t[1]}`);
            console.log(`   - State: ${t[12]} (${stateNames[t[12]] || "UNKNOWN"})`);
            console.log(`   - Price: ${formatUnits(t[2], 18)} USDC`);
            if (t[12] === 4) console.log(`   - Approved At: ${new Date(Number(t[8]) * 1000).toISOString()}`);
        } catch (e) {
            console.log(`\n>> Task #${i}: FAILED TO READ (Likely not created on-chain)`);
        }
    }
}

main();
