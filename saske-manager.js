import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "name": "buyer", "type": "address" }, { "name": "seller", "type": "address" }, { "name": "price", "type": "uint256" }, { "name": "verifierPool", "type": "uint256" }, { "name": "sellerBudget", "type": "uint256" }, { "name": "deadline", "type": "uint64" }, { "name": "bidDeadline", "type": "uint64" }, { "name": "verifierDeadline", "type": "uint64" }, { "name": "approvalTimestamp", "type": "uint64" }, { "name": "taskHash", "type": "bytes32" }, { "name": "resultHash", "type": "bytes32" }, { "name": "resultURI", "type": "string" }, { "name": "state", "type": "uint8" }, { "name": "quorumM", "type": "uint8" }, { "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

async function checkTask(taskId) {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    try {
        const task = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [BigInt(taskId)] });
        const bids = [];
        for (let i = 0n; i < 5n; i++) {
            try {
                const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [BigInt(taskId), i] });
                if (bid[4]) bids.push({ index: i, bidder: bid[0], price: formatUnits(bid[1], 18) });
            } catch (e) { break; }
        }
        return { task, bids, state: task[12], buyer: task[0], price: formatUnits(task[2], 18), deadline: Number(task[5]), bidDeadline: Number(task[6]) };
    } catch (err) { return null; }
}

async function main() {
    const sdk = new ArcManagedSDK();
    const now = Math.floor(Date.now() / 1000);
    const us = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

    console.log(`🦅 Saske: Status for Task #4 and #5...`);
    console.log(`   - Current Time: ${now} (00:58/59 UTC)`);
    console.log(`   - Agent Address: ${us}`);

    const t5 = await checkTask(5);
    if (t5) {
        const stateStr = ["None", "Bidding", "AuctionFinalized", "InProgress", "Completed", "Cancelled", "Disputed", "Resolved"][t5.state];
        console.log(`\n鹰 Task #5:`);
        console.log(`   - Buyer: ${t5.buyer}`);
        console.log(`   - State: ${t5.state} (${stateStr})`);
        console.log(`   - Bids: ${t5.bids.length}`);
    }

    const t4 = await checkTask(4);
    if (t4) {
        const stateStr = ["None", "Bidding", "AuctionFinalized", "InProgress", "Completed", "Cancelled", "Disputed", "Resolved"][t4.state];
        console.log(`\n鹰 Task #4:`);
        console.log(`   - Buyer: ${t4.buyer}`);
        console.log(`   - State: ${t4.state} (${stateStr})`);
        console.log(`   - Bid Deadline: ${t4.bidDeadline}`);
        console.log(`   - Bids: ${t4.bids.length}`);
    }
}

main();
