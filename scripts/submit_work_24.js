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
    const taskId = 24;
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    console.log(`🦅 Saske: Submitting Work for Task #${taskId}...`);

    try {
        const resultURI = "https://paymind.io/report/" + taskId + "/automated-bid-completion";
        const submitRes = await sdk.submitResult({
            taskId: taskId.toString(),
            hash: id("Task 24 Work 2026-03-31"),
            uri: resultURI 
        });
        if (!submitRes.success) throw new Error("SDK Submission failed: " + submitRes.error);
        
        for (let i = 0; i < 40; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [BigInt(taskId)] });
            if (t[12] === 3) break;
            if (i === 39) throw new Error("!! Submission NOT CONFIRMED.");
            console.log(".. Still waiting for block (Submission)...");
        }
        console.log(`>> ✅ Work Submitted for #${taskId}!`);

    } catch (err) {
        console.error("\n❌ Operation Failed:", err.message);
    }
}

main();
