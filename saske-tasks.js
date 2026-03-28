import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
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
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const count = await sdk.getTaskCounter();
        console.log(`📡 Total Tasks: ${count}`);

        for (let i = 1n; i <= BigInt(count); i++) {
            try {
                const t = await publicClient.readContract({
                    address: ESCROW_CA,
                    abi: ESCROW_ABI,
                    functionName: 'tasks',
                    args: [i]
                });
                
                if (t[0] !== "0x0000000000000000000000000000000000000000") {
                    console.log(`\n>> Task #${i}:`);
                    console.log(`   - Buyer: ${t[0]}`);
                    console.log(`   - State: ${t[12]}`);
                    console.log(`   - Price: ${formatUnits(t[2], 18)} USDC`);
                    console.log(`   - Bid Deadline: ${t[6]}`);
                }
            } catch (e) {
                // Ignore errors (out of bounds)
            }
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
