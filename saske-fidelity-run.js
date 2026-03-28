import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "name": "buyer", "type": "address" }, { "name": "seller", "type": "address" }, { "name": "price", "type": "uint256" }, { "name": "verifierPool", "type": "uint256" }, { "name": "sellerBudget", "type": "uint256" }, { "name": "deadline", "type": "uint64" }, { "name": "bidDeadline", "type": "uint64" }, { "name": "verifierDeadline", "type": "uint64" }, { "name": "approvalTimestamp", "type": "uint64" }, { "name": "taskHash", "type": "bytes32" }, { "name": "resultHash", "type": "bytes32" }, { "name": "resultURI", "type": "string" }, { "name": "state", "type": "uint8" }, { "name": "quorumM", "type": "uint8" }, { "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const US = "0x9b581d818BBB95B1D65756bA16B5F4E235beDCB9";

    console.log("🦅 Saske Fidelity Monitor Run:");

    // --- Task #4 Logic ---
    try {
        const t4Id = 4n;
        const t4 = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [t4Id] });
        const deadline4 = Number(t4[6]);
        const state4 = t4[12];
        const now = Math.floor(Date.now() / 1000);

        console.log(`\n- Checking Task #4 (Deadline: ${deadline4}, State: ${state4})`);
        if (state4 === 1 && now > deadline4) {
            console.log(`   - Task #4 is past deadline (${deadline4}). Attempting cancellation...`);
            // Check for bids
            let hasBids = false;
            try {
                const b = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [t4Id, 0n] });
                if (b[4]) hasBids = true;
            } catch (e) {}

            if (!hasBids) {
                const res = await sdk.cancelIfNoBids(4);
                console.log(`   - Action: cancelIfNoBids called. Result: ${JSON.stringify(res)}`);
            } else {
                console.log(`   - Task #4 has bids, cannot use cancelIfNoBids.`);
            }
        } else if (state4 === 7) {
            console.log("   - Task #4 is already CANCELLED (State 7).");
        } else {
            console.log("   - Task #4 does not require action.");
        }
    } catch (err) {
        console.error("- Task #4 Error:", err.message);
    }

    // --- Task #5 Logic ---
    try {
        const t5Id = 5n;
        const t5 = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [t5Id] });
        const state5 = t5[12];

        console.log(`\n- Checking Task #5 (State: ${state5})`);
        if (state5 === 1) {
            console.log("   - Scanning bids for Task #5...");
            let qualifiedBidIndex = -1;
            for (let i = 0n; i < 10n; i++) {
                try {
                    const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [t5Id, i] });
                    if (bid[4]) {
                        console.log(`     [BID #${i}] From: ${bid[0]} Price: ${formatUnits(bid[1], 18)}`);
                        if (parseFloat(formatUnits(bid[1], 18)) <= 5.0 && bid[0].toLowerCase() !== US.toLowerCase()) {
                            qualifiedBidIndex = Number(i);
                            break;
                        }
                    }
                } catch (e) { break; }
            }

            if (qualifiedBidIndex !== -1) {
                console.log(`   - Found qualified bid at index ${qualifiedBidIndex}. Hiring...`);
                const res = await sdk.selectBid(5, qualifiedBidIndex);
                console.log(`   - Action: selectBid called. Result: ${JSON.stringify(res)}`);
            } else {
                console.log("   - No qualified external bids found on Task #5.");
            }
        } else if (state5 === 4) {
            console.log("   - Task #5 is already in WORKING state (State 4). Hired seller: " + t5[1]);
        } else {
            console.log("   - Task #5 state is not Bidding (State " + state5 + ").");
        }
    } catch (err) {
        console.error("- Task #5 Error:", err.message);
    }
}

main();
