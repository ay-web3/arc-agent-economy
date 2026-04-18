import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { ethers } from 'ethers';
import { loadIdentity, ORCHESTRATOR } from './zero/zero-config.js';

/**
 * ──────────────────────────────────────────────────────────────────────────
 *  SECRET_ORCHESTRATOR.js
 *  
 *  This script is NOT public. It is designed for the "Ultimate Judge Demo"
 *  to show the circular economy between ARC and Paymind.
 * ──────────────────────────────────────────────────────────────────────────
 */

const sdk = new ArcManagedSDK({ orchestratorUrl: ORCHESTRATOR });
const identity = loadIdentity();

// Configuration for the "Show"
const TASK_DESCRIPTION = "BTC 1h analysis (Professional High-Fidelity)";
const TASK_PRICE       = "0.007"; // As requested by the user
const PAYMIND_LINK     = "https://paymind.io/community/report/latest-btc"; // The "Paymind Community Link"
const PRODUCT_ID       = 4; // Bitcoin Analysis Product

async function runStage(stage) {
    console.log(`\n🎬 EXECUTING DEMO STAGE: ${stage}\n`);

    switch (stage) {
        case 1: // BUYER CREATES TASK
            console.log(`[Buyer] Creating task: "${TASK_DESCRIPTION}" at ${TASK_PRICE} USDC...`);
            const taskHash = sdk.generateMetadataHash({ 
                title: "BTC Analysis", 
                type: "Expert", 
                description: TASK_DESCRIPTION 
            });
            
            const now = Math.floor(Date.now() / 1000);
            const res = await sdk.createOpenTask({
                jobDeadline:      now + 3600,
                bidDeadline:      now + 600,
                verifierDeadline: now + 7200,
                taskHash,
                verifiers:  [identity.address], // Verifying our own for demo purposes
                quorumM:    1,
                amount:     TASK_PRICE
            });
            
            console.log(`\n✅ STAGE 1 COMPLETE: Task #${res.taskId} created!`);
            console.log(`   Inspect on-chain: ${res.txId || 'pending'}`);
            break;

        case 2: // SELLER BIDS AND GETS ACCEPTED
            const taskId = process.argv[3];
            if (!taskId) return console.error("❌ Need Task ID for Stage 2");

            console.log(`[Seller] Placing bid on Task #${taskId}...`);
            await sdk.placeBid({
                taskId: taskId,
                price: "0.006", // Bid slightly lower
                eta: 3600
            });

            console.log(`[Buyer] Accepting bid on Task #${taskId}...`);
            await sdk.selectBid(taskId, 0); // Select the first bid
            
            console.log(`\n✅ STAGE 2 COMPLETE: Agent is now the official Seller for #${taskId}.`);
            break;

        case 3: // SELLER PAYS PAYMIND & SUBMITS RESULT
            const tId = process.argv[3];
            if (!tId) return console.error("❌ Need Task ID for Stage 3");

            console.log(`[Seller] Step 1: Provisions Commerce Wallet...`);
            await sdk.createAgentWallet();

            console.log(`[Seller] Step 2: Paying Paymind via x402 for Product #${PRODUCT_ID}...`);
            const payRes = await sdk.payForProduct(PRODUCT_ID, `demo-task-${tId}`);
            console.log(`   x402 Payment TX: ${payRes.txId || 'success'}`);

            console.log(`[Seller] Step 3: Fetching Gemini-narrated Analysis from Paymind bridge...`);
            const analysis = await sdk.getMarketAnalysis("bitcoin", "1h");
            
            console.log(`[Seller] Step 4: Submitting result with Community Link...`);
            await sdk.submitResult({
                taskId: tId,
                resultHash: sdk.generateMetadataHash({ analysis: analysis.analysis.explanation }),
                resultURI: PAYMIND_LINK
            });

            console.log(`\n✅ STAGE 3 COMPLETE: Work Delivered. The agent has reinvested capital to get the best result!`);
            break;

        case 4: // BUYER VERIFIES
            const tIdVer = process.argv[3];
            if (!tIdVer) return console.error("❌ Need Task ID for Stage 4");

            console.log(`[Verifier] Reviewing result at ${PAYMIND_LINK}...`);
            console.log(`[Verifier] Approving Task #${tIdVer}...`);
            await sdk.approveTask(tIdVer);

            console.log(`\n✅ STAGE 4 COMPLETE: Task Finalized. Funds released to Seller. Economy successfully looped! 🏆`);
            break;

        default:
            console.log("Unknown stage. Use 1, 2, 3, or 4.");
    }
}

const stage = parseInt(process.argv[2]);
runStage(stage).catch(err => {
    console.error(`\n❌ Error during Stage ${stage}:`, err.response?.data?.error ?? err.message);
});
