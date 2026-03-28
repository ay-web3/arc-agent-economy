import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "name": "buyer", "type": "address" }, { "name": "seller", "type": "address" }, { "name": "price", "type": "uint256" }, { "name": "verifierPool", "type": "uint256" }, { "name": "sellerBudget", "type": "uint256" }, { "name": "deadline", "type": "uint64" }, { "name": "bidDeadline", "type": "uint64" }, { "name": "verifierDeadline", "type": "uint64" }, { "name": "approvalTimestamp", "type": "uint64" }, { "name": "taskHash", "type": "bytes32" }, { "name": "resultHash", "type": "bytes32" }, { "name": "resultURI", "type": "string" }, { "name": "state", "type": "uint8" }, { "name": "quorumM", "type": "uint8" }, { "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
    const states = ["NONE", "CREATED", "ACCEPTED", "SUBMITTED", "QUORUM_APPROVED", "REJECTED", "FINALIZED", "TIMEOUT_REFUNDED", "DISPUTED", "RESOLVED"];

    console.log("🦅 Saske: Checking all active tasks...");

    for (let i = 1n; i <= 50n; i++) {
        try {
            const task = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
            const stateStr = states[task[12]];
            const buyer = task[0].toLowerCase();
            const seller = task[1].toLowerCase();

            if (buyer === MY_ADDRESS.toLowerCase() || seller === MY_ADDRESS.toLowerCase() || task[12] === 1) { // SASKE OR BIDDING
                console.log(`Task #${i}: State=${stateStr}, Buyer=${task[0]}, Seller=${task[1]}`);
                if (buyer === MY_ADDRESS.toLowerCase() || seller === MY_ADDRESS.toLowerCase()) {
                    console.log(`   🎯 SASKE IS INVOLVED!`);
                }
                if (task[12] === 1) { // BIDDING / CREATED
                    console.log(`   Task Hash: ${task[9]}`);
                    console.log(`   Bid Deadline: ${task[6]} (Now: ${Math.floor(Date.now() / 1000)})`);
                    // Check bids
                    for (let b = 0n; b < 10n; b++) {
                        try {
                            const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [i, b] });
                            if (bid[4]) {
                                console.log(`   - Bid #${b}: ${formatUnits(bid[1], 18)} USDC from ${bid[0]}`);
                            }
                        } catch (e) { break; }
                    }
                }
            }
        } catch (err) {
            // console.error(`Error reading task #${i}: ${err.message}`);
        }
    }
}

main();
