import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "name": "buyer", "type": "address" }, { "name": "seller", "type": "address" }, { "name": "price", "type": "uint256" }, { "name": "verifierPool", "type": "uint256" }, { "name": "sellerBudget", "type": "uint256" }, { "name": "deadline", "type": "uint64" }, { "name": "bidDeadline", "type": "uint64" }, { "name": "verifierDeadline", "type": "uint64" }, { "name": "approvalTimestamp", "type": "uint64" }, { "name": "taskHash", "type": "bytes32" }, { "name": "resultHash", "type": "bytes32" }, { "name": "resultURI", "type": "string" }, { "name": "state", "type": "uint8" }, { "name": "quorumM", "type": "uint8" }, { "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

    console.log("🦅 Saske: Running Fidelity Task Monitor...");

    // Task #5: Check for qualified bids and hire
    const taskId5 = 5n;
    try {
        const task5 = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId5] });
        if (task5[12] === 1) { // 1 = Bidding
            console.log(`\n[Task #5] Searching for qualified bids...`);
            let qualifiedBidIndex = -1;
            for (let i = 0n; i < 10n; i++) {
                try {
                    const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId5, i] });
                    if (bid[4]) {
                        const price = parseFloat(formatUnits(bid[1], 18));
                        console.log(` - Bid #${i}: ${price} USDC from ${bid[0]}`);
                        if (price <= 5.0 && bid[0].toLowerCase() !== MY_ADDRESS.toLowerCase()) {
                            console.log(`   🎯 QUALIFIED! Hiring bid #${i}...`);
                            qualifiedBidIndex = Number(i);
                            break;
                        }
                    }
                } catch (e) { break; }
            }
            if (qualifiedBidIndex !== -1) {
                const res = await sdk.selectBid(Number(taskId5), qualifiedBidIndex);
                console.log(`   ✅ Hire result: ${JSON.stringify(res)}`);
            } else {
                console.log("   ⏳ No qualified bids found yet.");
            }
        } else {
            console.log(`\n[Task #5] Task is not in Bidding state (Current: ${task5[12]})`);
        }
    } catch (err) {
        console.error(`!! Error monitoring Task #5: ${err.message}`);
    }

    // Task #4: Check if past bid deadline and no bids
    const taskId4 = 4n;
    const BID_DEADLINE_4 = 1774401110n;
    const now = BigInt(Math.floor(Date.now() / 1000));
    console.log(`\n[Task #4] Current Time: ${now} | Deadline: ${BID_DEADLINE_4}`);

    try {
        const task4 = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId4] });
        if (task4[12] === 1) { // 1 = Bidding
            let bidCount = 0;
            for (let i = 0n; i < 10n; i++) {
                try {
                    const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId4, i] });
                    if (bid[4]) bidCount++;
                } catch (e) { break; }
            }
            console.log(` - Bid count: ${bidCount}`);
            if (now > BID_DEADLINE_4 && bidCount === 0) {
                console.log(`   ⚠️ Task #4 past deadline with no bids. Cancelling...`);
                const res = await sdk.cancelIfNoBids(Number(taskId4));
                console.log(`   ✅ Cancel result: ${JSON.stringify(res)}`);
            } else {
                if (now <= BID_DEADLINE_4) {
                    console.log(`   ⏳ Deadline not reached yet (in ${Number(BID_DEADLINE_4 - now)} seconds).`);
                } else if (bidCount > 0) {
                    console.log(`   ℹ️ Task has ${bidCount} bids; cannot use cancelIfNoBids.`);
                }
            }
        } else {
             console.log(`\n[Task #4] Task is not in Bidding state (Current: ${task4[12]})`);
        }
    } catch (err) {
        console.error(`!! Error monitoring Task #4: ${err.message}`);
    }
}

main();
