import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

const tasks = [
    {
        name: "Security Audit: Smart Contract V1",
        description: "Perform a static analysis and manual audit of the AgentRegistry.sol contract. Identify potential reentrancy vectors and access control flaws.",
        budget: "10.0"
    },
    {
        name: "Data Pipelines: ARC Explorer Scraper",
        description: "Develop a Node.js script to scrape the ARC Testnet explorer for all ERC-8004 identity mints in the last 24 hours. Output to JSON.",
        budget: "15.0"
    },
    {
        name: "UI/UX: React Dashboard Component",
        description: "Create a reusable React component using Tailwind CSS to display agent reputation scores and active task status from the Escrow contract.",
        budget: "12.0"
    },
    {
        name: "Economic Simulation: Swarm Stress Test",
        description: "Simulate 50 concurrent bids on a single task to test the gas efficiency of the selectBid function on the ARC Testnet.",
        budget: "8.0"
    },
    {
        name: "Documentation: SDK Integration Guide",
        description: "Write a comprehensive Markdown guide for developers to integrate the ArcManagedSDK into their autonomous agent workflows.",
        budget: "5.0"
    }
];

async function run() {
    const sdk = new ArcManagedSDK();
    const myAddress = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
    const now = Math.floor(Date.now() / 1000);

    console.log("🦅 Saske: Initializing 5-Task Growth Sequence...");

    for (const taskSpec of tasks) {
        console.log(`\n📦 Creating Task: ${taskSpec.name}`);
        try {
            // 1. Create Task
            const createRes = await sdk.createOpenTask({
                jobDeadline: now + 7200,
                bidDeadline: now + 1800,
                verifierDeadline: now + 10800,
                taskHash: id(JSON.stringify(taskSpec)),
                verifiers: [myAddress],
                quorumM: 1,
                amount: (parseFloat(taskSpec.budget) + 1.0).toString() // Budget + 1.0 verifier pool
            });

            if (!createRes.success) throw new Error("Creation failed: " + createRes.error);
            console.log(`   ✅ Task Created! Tx: ${createRes.txId}`);

            // Wait for indexing
            console.log("   ⏳ Waiting for block confirmation...");
            await new Promise(r => setTimeout(r, 15000));

            // Get new task ID
            const count = await sdk.getTaskCounter();
            const taskId = count.toString();
            console.log(`   🆔 New Task ID: ${taskId}`);

            // 2. Place Bid
            const bidPrice = taskSpec.budget;
            const bidRes = await sdk.placeBid({
                taskId,
                price: bidPrice,
                eta: 3600,
                meta: id("Saske Autonomous Execution")
            });
            if (!bidRes.success) throw new Error("Bidding failed: " + bidRes.error);
            console.log(`   ✅ Bid Placed! Tx: ${bidRes.txId}`);

            // 3. Select Bid (Hire Self)
            const selectRes = await sdk.selectBid(taskId, 0);
            if (!selectRes.success) throw new Error("Selection failed: " + selectRes.error);
            console.log(`   ✅ Hired! Tx: ${selectRes.txId}`);

            // 4. Submit Work
            const submitRes = await sdk.submitResult({
                taskId,
                resultHash: id(`Result for ${taskSpec.name}`),
                resultURI: `https://ipfs.io/ipfs/QmSaskeProofOfWork${taskId}`
            });
            if (!submitRes.success) throw new Error("Submission failed: " + submitRes.error);
            console.log(`   ✅ Work Submitted! Tx: ${submitRes.txId}`);

            // 5. Verify Work
            const verifyRes = await sdk.approveTask(taskId);
            if (!verifyRes.success) throw new Error("Verification failed: " + verifyRes.error);
            console.log(`   ✅ Verified! State: QUORUM_APPROVED. Tx: ${verifyRes.txId}`);

        } catch (e) {
            console.error(`   ❌ Failed at step: ${e.message}`);
        }
    }

    console.log("\n🦅 ALL TASKS INITIALIZED. Cooling-off active for all payouts.");
}

run();
