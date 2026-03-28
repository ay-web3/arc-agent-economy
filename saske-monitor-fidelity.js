import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';
import path from 'path';

// Manual arg parsing to avoid external dependencies
const args = process.argv.slice(2);
const options = {
    taskId: args.find(a => a.startsWith('--task-id'))?.split('=')[1] || "5",
    autoHire: args.includes('--auto-hire'),
    cancelStale: args.includes('--cancel-stale')
};

const TARGET_TASK_ID = BigInt(options.taskId);

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "internalType": "uint256", "name": "taskId", "type": "uint256" }, { "internalType": "uint256", "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "internalType": "address", "name": "bidder", "type": "address" }, { "internalType": "uint256", "name": "bidPrice", "type": "uint256" }, { "internalType": "uint64", "name": "etaSeconds", "type": "uint64" }, { "internalType": "bytes32", "name": "metaHash", "type": "bytes32" }, { "internalType": "bool", "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "internalType": "address", "name": "buyer", "type": "address" }, { "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "uint256", "name": "price", "type": "uint256" }, { "internalType": "uint256", "name": "verifierPool", "type": "uint256" }, { "internalType": "uint256", "name": "sellerBudget", "type": "uint256" }, { "internalType": "uint64", "name": "deadline", "type": "uint64" }, { "internalType": "uint64", "name": "bidDeadline", "type": "uint64" }, { "internalType": "uint64", "name": "verifierDeadline", "type": "uint64" }, { "internalType": "uint64", "name": "approvalTimestamp", "type": "uint64" }, { "internalType": "bytes32", "name": "taskHash", "type": "bytes32" }, { "internalType": "bytes32", "name": "resultHash", "type": "bytes32" }, { "internalType": "string", "name": "resultURI", "type": "string" }, { "internalType": "uint8", "name": "state", "type": "uint8" }, { "internalType": "uint8", "name": "quorumM", "type": "uint8" }, { "internalType": "uint8", "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

const STATE_NAMES = ["None", "Created", "Accepted", "Submitted", "Quorum_Approved", "Rejected", "Finalized", "Timeout_Refunded", "Disputed", "Resolved"];

async function main() {
    const sdk = new ArcManagedSDK({ secretPath: path.join(process.cwd(), 'arc-agent-economy', '.agent_secret') });
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log(`🦅 Saske: Arc Fidelity Monitor v2.1`);
    console.log(`   - Time: ${new Date().toUTCString()}`);

    try {
        // --- 1. MONITOR TARGET TASK ---
        console.log(`\n🔍 Checking Task #${TARGET_TASK_ID}...`);
        const task = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [TARGET_TASK_ID] });
        const state = task[12];
        const bidDeadline = Number(task[6]);
        const now = Math.floor(Date.now() / 1000);
        const nowBigInt = BigInt(now);
        
        console.log(`   - Current State: ${STATE_NAMES[state] || state}`);
        
        if (state === 1) { // Created (Bidding)
            console.log(`   - Scanning for qualified bids...`);
            let foundBids = 0;
            for (let i = 0n; i < 20n; i++) {
                try {
                    const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [TARGET_TASK_ID, i] });
                    if (bid[4]) {
                        foundBids++;
                        const price = parseFloat(formatUnits(bid[1], 18));
                        console.log(`   [BID #${i}] From: ${bid[0]} | Price: ${price} USDC`);
                        
                        // Hiring logic: price <= 5.0 USDC
                        if (price <= 5.0 && options.autoHire) {
                            console.log(`   🎯 QUALIFIED! Attempting to hire bid #${i}...`);
                            try {
                                const result = await sdk.selectBid(Number(TARGET_TASK_ID), Number(i));
                                console.log(`   ✅ SUCCESS: ${result.message || 'Bid selected'}`);
                                break; // Stop after hiring one
                            } catch (e) {
                                console.error(`   ❌ Failed to hire: ${e.message}`);
                            }
                        }
                    }
                } catch (e) { break; }
            }
            if (foundBids === 0) console.log("   ⏳ No bids found yet.");
        }

        // --- 2. SCAN TASK COUNTER FOR STALE TASKS ---
        if (options.cancelStale) {
            console.log(`\n📡 Scanning Task Counter for stale tasks...`);
            const counter = await sdk.getTaskCounter();
            console.log(`   - Total Tasks: ${counter}`);

            for (let tid = 1; tid <= counter; tid++) {
                try {
                    const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [BigInt(tid)] });
                    const tState = t[12];
                    const tBidDeadline = BigInt(t[6]);
                    
                    if ((tState === 1 || tState === 0) && nowBigInt > tBidDeadline && tBidDeadline > 0n) {
                        if (tid === 1) continue; // Skip persistent Task #1
                        if (tState === 0 && tBidDeadline < 1000n) continue; // Skip uninitialized
                        console.log(`   - Task #${tid}: State ${STATE_NAMES[tState] || tState}, deadline passed (${tBidDeadline} < ${nowBigInt})`);
                        // Check if it has NO bids
                        let hasBids = false;
                        try {
                            const firstBid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [BigInt(tid), 0n] });
                            if (firstBid[4]) hasBids = true;
                        } catch (e) {}

                        if (!hasBids) {
                            console.log(`   ⚠️ Task #${tid} is STALE (Deadline passed, 0 bids). Reclaiming...`);
                            try {
                                const result = await sdk.cancelIfNoBids(tid);
                                console.log(`   ✅ RECLAIMED: ${result.message || 'USDC returned'}`);
                            } catch (e) {
                                console.error(`   ❌ Failed to reclaim #${tid}: ${e.message}`);
                            }
                        } else {
                            console.log(`   ℹ️ Task #${tid} has bids, skipping cancel.`);
                        }
                    }
                } catch (e) { continue; }
            }
        }

    } catch (err) {
        console.error("!! Global Error:", err.message);
    }
}

main();
