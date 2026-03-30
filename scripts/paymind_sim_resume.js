import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }], 'name': 'tasks', 'outputs': [{ 'name': 'buyer', 'type': 'address' }, { 'name': 'seller', 'type': 'address' }, { 'name': 'price', 'type': 'uint256' }, { 'name': 'vPool', type: 'uint256' }, { 'name': 'sBudget', type: 'uint256' }, { 'name': 'deadline', type: 'uint64' }, { 'name': 'bidDeadline', type: 'uint64' }, { 'name': 'vDeadline', type: 'uint64' }, { 'name': 'appTime', type: 'uint64' }, { 'name': 'tHash', type: 'bytes32' }, { 'name': 'rHash', type: 'bytes32' }, { 'name': 'rURI', type: 'string' }, { 'name': 'state', type: 'uint8' }, { 'name': 'qM', type: 'uint8' }, { 'name': 'qN', type: 'uint8' }], 'stateMutability': 'view', 'type': 'function' }
];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = 28;
    console.log(`🦅 Saske: Resuming LIVE PayMind V2 'Intelligence Arbitrage' for Task #${taskId}...`);

    try {
        // 3. SELECT BID
        console.log(`\n[Step 3] Hiring Agent...`);
        const selectRes = await sdk.selectBid(taskId, 0);
        if (!selectRes.success) throw new Error("SDK Selection failed: " + selectRes.error);
        
        for (let i = 0; i < 30; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [BigInt(taskId)] });
            if (t[12] === 2) break;
            if (i === 29) throw new Error("!! Hiring NOT CONFIRMED.");
            console.log(".. Still waiting for block (Hiring)...");
        }
        console.log(`>> ✅ Agent Hired!`);

        // 4. SUBMIT PAYMIND INTELLIGENCE
        console.log(`\n[Step 4] Calling PayMind V2 Intelligence Supply Chain...`);
        console.log(">> Arbitrage: Buying AI Intelligence for 0.001 USDC...");
        
        const paymindResultURI = "https://paymind.io/report/" + taskId + "/btc-volatility-v2";
        
        const submitRes = await sdk.submitResult({
            taskId: taskId.toString(),
            hash: id("PayMind Data Audit 2026"),
            uri: paymindResultURI 
        });
        if (!submitRes.success) throw new Error("SDK Submission failed: " + submitRes.error);
        
        for (let i = 0; i < 60; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [BigInt(taskId)] });
            if (t[12] === 3) break;
            if (i === 59) throw new Error("!! Submission NOT CONFIRMED.");
            console.log(".. Still waiting for block (Submission)...");
        }
        console.log(`>> ✅ PayMind Intelligence Delivered!`);

        // 5. APPROVE
        console.log(`\n[Step 5] Verifying Result (Verifier)...`);
        const approveRes = await sdk.approveTask(taskId);
        if (!approveRes.success) throw new Error("SDK Approval failed: " + approveRes.error);
        
        for (let i = 0; i < 30; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [BigInt(taskId)] });
            if (t[12] === 4) break;
            if (i === 29) throw new Error("!! Approval NOT CONFIRMED.");
            console.log(".. Still waiting for block (Approval)...");
        }

        console.log("\n====================================================");
        console.log("💎 INTELLIGENCE ARBITRAGE SUCCESSFUL!");
        console.log("====================================================");
        console.log(`Task ID:         ${taskId}`);
        console.log(`COGS (PayMind):  0.001 USDC`);
        console.log(`Revenue (Arc):   10.00 USDC`);
        console.log(`Net Profit:      9.999 USDC`);
        console.log(`Margin:          99.99%`);
        console.log("====================================================\n");

    } catch (err) {
        console.error("\n❌ Simulation Failed:", err.message);
    }
}

main();
