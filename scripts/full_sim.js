import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id, formatUnits } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { 'inputs': [], 'name': 'taskCounter', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' },
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }], 'name': 'tasks', 'outputs': [{ 'name': 'buyer', 'type': 'address' }, { 'name': 'seller', 'type': 'address' }, { 'name': 'price', 'type': 'uint256' }, { 'name': 'vPool', type: 'uint256' }, { 'name': 'sBudget', type: 'uint256' }, { 'name': 'deadline', type: 'uint64' }, { 'name': 'bidDeadline', type: 'uint64' }, { 'name': 'vDeadline', type: 'uint64' }, { 'name': 'appTime', type: 'uint64' }, { 'name': 'tHash', type: 'bytes32' }, { 'name': 'rHash', type: 'bytes32' }, { 'name': 'rURI', type: 'string' }, { 'name': 'state', type: 'uint8' }, { 'name': 'qM', type: 'uint8' }, { 'name': 'qN', type: 'uint8' }], 'stateMutability': 'view', 'type': 'function' },
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }, { 'name': 'index', 'type': 'uint256' }], 'name': 'bids', 'outputs': [{ 'name': 'bidder', 'type': 'address' }, { 'name': 'bidPrice', 'type': 'uint256' }, { 'name': 'etaSeconds', 'type': 'uint64' }, { 'name': 'metaHash', 'type': 'bytes32' }, { 'name': 'exists', 'type': 'bool' }], 'stateMutability': 'view', 'type': 'function' }
];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    console.log("🦅 Saske: Starting Bulletproof Ecosystem Simulation...");

    try {
        const initialCounter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        
        // 1. CREATE TASK
        console.log("\n[Step 1] Creating Task (Buyer Role)...");
        const now = Math.floor(Date.now() / 1000);
        const createRes = await sdk.createOpenTask({
            jobDeadline: now + 86400,
            bidDeadline: now + 3600,
            verifierDeadline: now + 90000,
            taskHash: id("Full Bulletproof Simulation " + now),
            verifiers: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"],
            quorumM: 1,
            amount: "5.0" // Enough to cover verifier pool (1.0) and seller budget (4.0)
        });

        if (!createRes.success) throw new Error("SDK Create failed: " + createRes.error);
        console.log(">> Request Sent. TX ID:", createRes.txId);

        let taskId;
        for (let i = 0; i < 20; i++) {
            await sleep(5000);
            taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
            if (taskId > initialCounter) break;
            if (i === 19) throw new Error("!! Task creation NOT CONFIRMED on blockchain.");
            console.log(".. Waiting for block...");
        }
        console.log(`>> ✅ Task Created! ID: ${taskId}`);

        // 2. PLACE BID
        console.log(`\n[Step 2] Placing Bid (Seller Role)...`);
        const bidRes = await sdk.placeBid({
            taskId: taskId.toString(),
            price: "2.0", // Valid (<= 4.0 budget)
            eta: 3600,
            meta: id("Expert Analysis")
        });
        if (!bidRes.success) throw new Error("SDK Bid failed: " + bidRes.error);
        console.log(">> Request Sent. TX ID:", bidRes.txId);

        for (let i = 0; i < 20; i++) {
            await sleep(5000);
            try {
                const b = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, 0n] });
                if (b.exists) break;
            } catch (e) {}
            if (i === 19) throw new Error("!! Bid NOT CONFIRMED on blockchain.");
            console.log(".. Waiting for block...");
        }
        console.log(`>> ✅ Bid Placed!`);

        // 3. SELECT BID (Hiring)
        console.log(`\n[Step 3] Hiring Agent (Buyer Role)...`);
        const selectRes = await sdk.selectBid(Number(taskId), 0);
        if (!selectRes.success) throw new Error("SDK Selection failed: " + selectRes.error);
        
        for (let i = 0; i < 20; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
            if (t[12] === 2) break; // State.ACCEPTED
            if (i === 19) throw new Error("!! Hiring NOT CONFIRMED on blockchain.");
            console.log(".. Waiting for block...");
        }
        console.log(`>> ✅ Agent Hired!`);

        // 4. SUBMIT WORK
        console.log(`\n[Step 4] Submitting Work (Seller Role)...`);
        const submitRes = await sdk.submitResult({
            taskId: taskId.toString(),
            hash: id("Simulation Result Hash"),
            uri: "https://paymind.io/result-verify-" + taskId
        });
        if (!submitRes.success) throw new Error("SDK Submission failed: " + submitRes.error);
        
        for (let i = 0; i < 20; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
            if (t[12] === 3) break; // State.SUBMITTED
            if (i === 19) throw new Error("!! Submission NOT CONFIRMED on blockchain.");
            console.log(".. Waiting for block...");
        }
        console.log(`>> ✅ Work Delivered!`);

        // 5. APPROVE
        console.log(`\n[Step 5] Approving Work (Verifier Role)...`);
        const approveRes = await sdk.approveTask(Number(taskId));
        if (!approveRes.success) throw new Error("SDK Approval failed: " + approveRes.error);
        
        for (let i = 0; i < 20; i++) {
            await sleep(5000);
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
            if (t[12] === 4) break; // State.QUORUM_APPROVED
            if (i === 19) throw new Error("!! Approval NOT CONFIRMED on blockchain.");
            console.log(".. Waiting for block...");
        }
        console.log(`>> ✅ Work Approved! (Simulation Complete)`);

    } catch (err) {
        console.error("\n❌ Simulation Failed:", err.message);
    }
}

main();
