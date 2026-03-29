import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id, formatUnits } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [{ 'inputs': [], 'name': 'taskCounter', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    console.log("🦅 Saske: Starting Full Ecosystem Simulation...");

    try {
        // 1. CREATE TASK
        console.log("\n[Step 1] Creating Task on Arc Economy...");
        const now = Math.floor(Date.now() / 1000);
        const createRes = await sdk.createOpenTask({
            jobDeadline: now + 3600,
            bidDeadline: now + 1800,
            verifierDeadline: now + 5400,
            taskHash: id("Full Simulation Run " + now),
            verifiers: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"],
            quorumM: 1,
            value: "2.0" 
        });

        if (!createRes.success) throw new Error("Create failed: " + createRes.error);
        
        console.log(">> Waiting for blockchain settlement...");
        await sleep(10000); // Wait 10s for the block

        const taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        console.log(`>> ✅ Task Created! ID: ${taskId}`);

        // 2. PLACE BID
        console.log(`\n[Step 2] Bidding on Task #${taskId}...`);
        const bidRes = await sdk.placeBid({
            taskId: taskId.toString(),
            price: "1.5",
            eta: 300,
            meta: "Simulated Expert Bid"
        });
        if (!bidRes.success) throw new Error("Bid failed: " + bidRes.error);
        console.log(`>> ✅ Bid Placed!`);

        // 3. SELECT BID (Hiring)
        console.log(`\n[Step 3] Selecting Bid for Task #${taskId}...`);
        const selectRes = await sdk.selectBid(Number(taskId), 0);
        if (!selectRes.success) throw new Error("Selection failed: " + selectRes.error);
        console.log(`>> ✅ Worker Hired!`);

        // 4. SUBMIT WORK
        console.log(`\n[Step 4] Submitting Work (Supply Chain Content)...`);
        const submitRes = await sdk.submitResult({
            taskId: taskId.toString(),
            resultHash: id("Simulated High Quality Result"),
            resultURI: "https://paymind.io/sim-result-" + taskId
        });
        if (!submitRes.success) throw new Error("Submission failed: " + submitRes.error);
        console.log(`>> ✅ Work Delivered!`);

        // 5. APPROVE (Verification)
        console.log(`\n[Step 5] Verifying Work...`);
        const approveRes = await sdk.approveTask(Number(taskId));
        if (!approveRes.success) throw new Error("Approval failed: " + approveRes.error);
        console.log(`>> ✅ Work Approved! (Quorum Reached)`);

        console.log("\n====================================================");
        console.log("🎉 SIMULATION SUCCESSFUL!");
        console.log("====================================================");
        console.log(`The Supply Chain has been updated on the dashboard.`);
        console.log(`A 1-hour cooling-off period has started before finalization.`);
        console.log("====================================================\n");

    } catch (err) {
        console.error("\n❌ Simulation Interrupted:", err.message);
    }
}

main();
