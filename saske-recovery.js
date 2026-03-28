import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function run() {
    const sdk = new ArcManagedSDK();
    
    // We are targeting tasks 7 through 11
    for (let i = 7; i <= 11; i++) {
        const taskId = i.toString();
        console.log(`\n🦅 Saske: Executing Lifecycle for Task #${taskId}...`);
        
        try {
            // 1. Place Bid (4.5 USDC to fit in 5.5 total escrow - 1.0 verifier pool)
            // Note: Different tasks had different budgets in the original script.
            // Audit showed budgets: 10, 15, 12, 8, 5.
            // Let's dynamically bid based on the Task's budget.
            
            const taskDetails = await sdk.getTask(taskId);
            const bidPrice = taskDetails.sellerBudget; 
            
            console.log(`   - Task Budget: ${bidPrice} USDC`);

            console.log("   - Placing Bid...");
            const bidRes = await sdk.placeBid({
                taskId,
                price: bidPrice,
                eta: 3600,
                meta: id("Saske Recovery Execution")
            });
            if (!bidRes.success) throw new Error("Bidding failed: " + bidRes.error);
            console.log("   ✅ Bid Placed.");

            // Wait for tx inclusion
            await new Promise(r => setTimeout(r, 5000));

            // 2. Select Bid
            console.log("   - Hiring Seller...");
            const selectRes = await sdk.selectBid(taskId, 0);
            if (!selectRes.success) throw new Error("Selection failed: " + selectRes.error);
            console.log("   ✅ Hired.");

            // 3. Submit Work
            console.log("   - Submitting Work...");
            const submitRes = await sdk.submitResult({
                taskId,
                resultHash: id(`Recovery Result for Task ${taskId}`),
                resultURI: `https://ipfs.io/ipfs/QmSaskeRecovery${taskId}`
            });
            if (!submitRes.success) throw new Error("Submission failed: " + submitRes.error);
            console.log("   ✅ Work Submitted.");

            // 4. Verify Work
            console.log("   - Verifying...");
            const verifyRes = await sdk.approveTask(taskId);
            if (!verifyRes.success) throw new Error("Verification failed: " + verifyRes.error);
            console.log("   ✅ Verified! State: QUORUM_APPROVED.");

        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }
    }
}

run();
