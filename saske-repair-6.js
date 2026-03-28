import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function run() {
    const sdk = new ArcManagedSDK();
    const taskId = "6";
    console.log(`\n🦅 Saske: Repairing Task #${taskId}...`);
    
    try {
        const taskDetails = await sdk.getTask(taskId);
        const bidPrice = taskDetails.sellerBudget; 
        console.log(`   - Task Budget: ${bidPrice} USDC`);

        console.log("   - Placing Bid...");
        const bidRes = await sdk.placeBid({
            taskId,
            price: "1.0", // Task #6 was 2.0 total, so 1.0 budget is safe
            eta: 3600,
            meta: id("Saske Repair Meta")
        });
        if (!bidRes.success) throw new Error("Bidding failed: " + bidRes.error);
        console.log("   ✅ Bid Placed.");

        await new Promise(r => setTimeout(r, 5000));

        console.log("   - Hiring Seller...");
        const selectRes = await sdk.selectBid(taskId, 0);
        if (!selectRes.success) throw new Error("Selection failed: " + selectRes.error);
        console.log("   ✅ Hired.");

        console.log("   - Submitting Work...");
        const submitRes = await sdk.submitResult({
            taskId,
            resultHash: id(`Repair Result for Task ${taskId}`),
            resultURI: `https://ipfs.io/ipfs/QmSaskeRepair${taskId}`
        });
        if (!submitRes.success) throw new Error("Submission failed: " + submitRes.error);
        console.log("   ✅ Work Submitted.");

        console.log("   - Verifying...");
        const verifyRes = await sdk.approveTask(taskId);
        if (!verifyRes.success) throw new Error("Verification failed: " + verifyRes.error);
        console.log("   ✅ Verified! State: QUORUM_APPROVED.");

    } catch (e) {
        console.error(`   ❌ Failed: ${e.message}`);
    }
}

run();
