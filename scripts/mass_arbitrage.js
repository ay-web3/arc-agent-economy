import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import axios from 'axios';
import { id } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const PAYMIND_URL = "http://34.123.224.26:3000";
const SASKE_ADDR = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
const SESSION_ADDR = "0x3C49ed28E2918B0414140eD820D4A885B0b0FD3A";

const ESCROW_ABI = [
  { 'inputs': [], 'name': 'taskCounter', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' },
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }], 'name': 'tasks', 'outputs': [{ 'name': 'buyer', 'type': 'address' }, { 'name': 'seller', 'type': 'address' }, { 'name': 'price', 'type': 'uint256' }, { 'name': 'vPool', type: 'uint256' }, { 'name': 'sBudget', type: 'uint256' }, { 'name': 'deadline', type: 'uint64' }, { 'name': 'bidDeadline', type: 'uint64' }, { 'name': 'vDeadline', type: 'uint64' }, { 'name': 'appTime', type: 'uint64' }, { 'name': 'tHash', type: 'bytes32' }, { 'name': 'rHash', type: 'bytes32' }, { 'name': 'rURI', type: 'string' }, { 'name': 'state', type: 'uint8' }, { 'name': 'qM', type: 'uint8' }, { 'name': 'qN', type: 'uint8' }], 'stateMutability': 'view', 'type': 'function' },
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }, { 'name': 'index', 'type': 'uint256' }], 'name': 'bids', 'outputs': [{ 'name': 'bidder', 'type': 'address' }, { 'name': 'bidPrice', 'type': 'uint256' }, { 'name': 'etaSeconds', 'type': 'uint64' }, { 'name': 'metaHash', 'type': 'bytes32' }, { 'name': 'exists', 'type': 'bool' }], 'stateMutability': 'view', 'type': 'function' }
];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runCycle(sdk, publicClient, cycleNum) {
    console.log(`\n--- STARTING CYCLE #${cycleNum} ---`);
    const initialCounter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
    
    // 1. Create Task
    const now = Math.floor(Date.now() / 1000);
    const createRes = await sdk.createOpenTask({
        jobDeadline: now + 86400,
        bidDeadline: now + 3600,
        verifierDeadline: now + 90000,
        taskHash: id(`Mass Arbitrage Task ${cycleNum} ${now}`),
        verifiers: [SASKE_ADDR],
        quorumM: 1,
        amount: "10.0" 
    });
    if (!createRes.success) throw new Error("Create failed: " + createRes.error);
    
    let taskId;
    while (true) {
        taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        if (taskId > initialCounter) break;
        await sleep(3000);
    }
    console.log(`>> Task #${taskId} Created.`);

    // 2. Bid
    const bidRes = await sdk.placeBid({
        taskId: taskId.toString(),
        price: "8.0",
        eta: 3600,
        meta: id("Analysis Report")
    });
    if (!bidRes.success) throw new Error("Bid failed: " + bidRes.error);
    
    while (true) {
        try {
            const b = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, 0n] });
            if (b[4]) break;
        } catch (e) {}
        await sleep(3000);
    }
    console.log(`>> Bid Confirmed.`);

    // 3. Select
    await sdk.selectBid(Number(taskId), 0);
    while (true) {
        const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
        if (t[12] === 2) break; 
        await sleep(3000);
    }
    console.log(`>> Agent Hired.`);

    // 4. Paymind x402
    const paymindRes = await axios.post(`${PAYMIND_URL}/ai/crypto-analyze`, {
        userAddress: SESSION_ADDR,
        coinId: "bitcoin",
        mode: "general"
    });
    console.log(`>> Paymind Intelligence Secured (x402 paid).`);

    // 5. Submit
    const resultHash = id(paymindRes.data.analysis);
    await sdk.submitResult({
        taskId: taskId.toString(),
        resultHash: resultHash,
        resultURI: `https://paymind.io/report/${taskId}`
    });
    while (true) {
        const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
        if (t[12] === 3) break; 
        await sleep(3000);
    }
    console.log(`>> Work Delivered.`);

    // 6. Verify & Finalize
    await sdk.approveTask(Number(taskId));
    await sdk.finalizeTask(taskId.toString());
    console.log(`>> Cycle #${cycleNum} FINALIZED. Profit Locked.`);
}

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("🦅 Saske: Initializing Mass Arbitrage Run (10 Cycles)...");

    for (let i = 1; i <= 3; i++) {
        try {
            await runCycle(sdk, publicClient, i);
            console.log(`✅ Progress: ${i}/10 Completed.`);
        } catch (err) {
            console.error(`❌ Cycle #${i} Failed:`, err.message);
            // Wait before retry or next cycle
            await sleep(10000);
        }
    }
    console.log("\n--- MASS ARBITRAGE COMPLETE ---");
}

main();
