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
    ], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = 5n;

    console.log(`🔍 Saske Diagnostic: Auditing Task #${taskId}...`);

    try {
        const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
        console.log(`>> State: ${t[12]} (1=Bidding, 2=Accepted/Work, 3=Submitted, 4=QuorumApproved)`);
        console.log(`>> Seller: ${t[1]}`);
        console.log(`>> Price: ${formatUnits(t[2], 18)} USDC`);
        console.log(`>> Verifier Pool: ${formatUnits(t[3], 18)} USDC`);
        console.log(`>> Seller Budget: ${formatUnits(t[4], 18)} USDC`);

        console.log("\n>> Scanning Bids for index 0...");
        try {
            const b = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, 0n] });
            console.log(`   - Bid Exists: ${b[4]}`);
            console.log(`   - Bidder: ${b[0]}`);
            console.log(`   - Price: ${formatUnits(b[1], 18)} USDC`);
        } catch (e) {
            console.log("   - Bid #0 does not exist in the contract.");
        }

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
