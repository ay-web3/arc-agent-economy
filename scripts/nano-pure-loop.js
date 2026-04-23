import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app"; // Fallback if needed, but since we are running locally:
const LOCAL_HUB = "http://localhost:8080";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    console.log("====================================================================");
    console.log("   ARC AGENT ECONOMY - OFF-CHAIN NANO STATE CHANNEL (ZERO GAS)");
    console.log("====================================================================\n");
    
    console.log("[SYSTEM] Connecting to Sovereign Hub State Channel...");
    await sleep(1000);

    const buyerSDK = new ArcManagedSDK({ orchestratorUrl: HUB_URL, secretPath: './.buyer_secret' });
    const sellerSDK = new ArcManagedSDK({ orchestratorUrl: HUB_URL, secretPath: './.seller_secret' });
    const verifierSDK = new ArcManagedSDK({ orchestratorUrl: HUB_URL, secretPath: './.verifier_secret' });

    console.log("[PROTOCOL] Syncing Off-Chain Identities...");
    const buyer = await buyerSDK.selfOnboard("Buyer_Alpha");
    const seller = await sellerSDK.selfOnboard("Seller_Alpha");
    const verifier = await verifierSDK.selfOnboard("Verifier_Alpha");

    console.log("\n[LEDGER] Buyer depositing 1.0 USDC into Prepaid Nano Ledger (On-Chain)...");
    console.log("   >> Simulated: Tx Confirmed. Nano Balance: 1.0 USDC\n");
    await sleep(2000);

    // Run 3 tasks to trigger the batch settlement
    for (let i = 1; i <= 3; i++) {
        console.log(`--- NANO TASK #${i} ---`);
        
        console.log("[MARKET] Buyer creating off-chain task (0.0001 USDC)...");
        const res1 = await buyerSDK.createNanoTask({
            amount: "0.0001",
            manifestHash: "0xabc123"
        });
        const taskId = res1.taskId;
        console.log(`   [OK] Task ${taskId} Created Instantly. Gas: $0.00`);

        console.log("[MARKET] Seller bidding off-chain (0.00005 USDC)...");
        await sellerSDK.placeNanoBid({ taskId, bidPrice: "0.00005" });
        console.log(`   [OK] Bid Placed Instantly. Gas: $0.00`);

        console.log("[MARKET] Buyer selecting bid...");
        await buyerSDK.selectNanoBid({ taskId, bidIndex: 0 });

        console.log("[WORK] Seller submitting work...");
        await sellerSDK.submitNanoResult({ taskId, resultURI: "https://gateway.paymind.community/ipfs/QmNanoTask" + i });
        console.log(`   [OK] Work Submitted. Gas: $0.00`);

        console.log("[VERIFICATION] Verifier auditing...");
        await verifierSDK.approveNanoTask({ taskId });
        console.log(`   [OK] Audit Complete. Gas: $0.00\n`);
        
        await sleep(1000); // Super fast because it's off-chain!
    }

    console.log("====================================================================");
    console.log("   SIMULATION COMPLETE - BATCH SETTLEMENT EXECUTED");
    console.log("====================================================================");
}

run().catch(err => {
    console.error("Simulation Failed:", err);
    process.exit(1);
});
