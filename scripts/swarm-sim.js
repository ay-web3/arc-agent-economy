import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import crypto from 'crypto';
import readline from 'readline';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const waitManual = (msg) => new Promise(resolve => rl.question(`\n⚠️ [MANUAL CHECKPOINT] ${msg}\n>> Press Enter when done to resume...`, () => resolve()));

async function runSimulation() {
    console.log("🛰️ INITIALIZING ARC SOVEREIGN SWARM (v6.2/SDK)...");
    
    // sessionSuffix: Ensures clean retries without agentName collisions
    const sessionSuffix = Date.now().toString().slice(-4);

    // 1. Instantiate Hub-Linked SDKs
    const sellerSDK = new ArcManagedSDK({ hubUrl: HUB_URL });
    const verifierSDK = new ArcManagedSDK({ hubUrl: HUB_URL });
    const buyerSDK = new ArcManagedSDK({ hubUrl: HUB_URL });

    try {
        // 2. Onboard Agents (Birth Phase)
        console.log("\n🐣 Step 1: Onboarding Sovereign Agents...");
        
        const seller = await sellerSDK.selfOnboard(`Saske_Seller_${sessionSuffix}`);
        console.log(`✅ Saske BORN: ${seller.address}`);

        const verifier = await verifierSDK.selfOnboard(`Itachi_Verifier_${sessionSuffix}`);
        console.log(`✅ Itachi BORN: ${verifier.address}`);

        const buyer = await buyerSDK.selfOnboard(`Naruto_Buyer_${sessionSuffix}`);
        console.log(`✅ Naruto BORN: ${buyer.address}`);

        // 3. Manual Funding Checkpoint (Strict Stakes)
        console.log("\n💰 Step 2: Protocol Stake Calibration...");
        console.log("--------------------------------------------------");
        console.log(`1. Send 5.1 ARC to SASKE: ${seller.address}`);
        console.log(`2. Send 3.1 ARC to ITACHI: ${verifier.address}`);
        console.log(`3. Send 0.1 ARC to NARUTO: ${buyer.address} (Gas Only)`);
        console.log("--------------------------------------------------");
        
        await waitManual("Please fuel the agents via your ARC Wallet/Faucet.");

        // 4. Registration (NFT Identity Sync)
        console.log("\n🛡️ Step 3: Registering on ARC Identity Registry...");
        
        const sellerReg = await sellerSDK.registerAgent({
            asSeller: true,
            asVerifier: false,
            capHash: crypto.createHash('sha256').update("High-Speed Web Scraping & AI Analysis").digest('hex'),
            pubKey: crypto.randomBytes(32).toString('hex'),
            amount: "5" // User-Calibrated Seller Stake
        });
        console.log(`✅ Saske REGISTERED: ${sellerReg.txId}`);

        const verifierReg = await verifierSDK.registerAgent({
            asSeller: false,
            asVerifier: true,
            capHash: crypto.createHash('sha256').update("Autonomous Quality Assurance").digest('hex'),
            pubKey: crypto.randomBytes(32).toString('hex'),
            amount: "3" // User-Calibrated Verifier Stake
        });
        console.log(`✅ Itachi REGISTERED: ${verifierReg.txId}`);

        // 5. Task Creation (Buyer)
        console.log("\n📋 Step 4: Naruto Creating Open Task (Escrow)...");
        const jobDeadline = Math.floor(Date.now() / 1000) + 3600;
        const bidDeadline = Math.floor(Date.now() / 1000) + 1800;
        
        const task = await buyerSDK.createOpenTask({
            jobDeadline,
            bidDeadline,
            verifierDeadline: jobDeadline + 1800,
            taskHash: crypto.createHash('sha256').update("Scrape 100 Top Cryptos").digest('hex'),
            verifiers: [verifier.address],
            quorumM: 1,
            isNano: true,
            amount: "0.001" // Small prize for simulation
        });
        const taskId = task.log?.taskId || 1; // Fallback if log not parsed
        console.log(`✅ Task CREATED (ID: ${taskId}). Tx: ${task.txId}`);

        // 6. Bidding (Seller)
        console.log("\n🤝 Step 5: Saske Placing Bid...");
        await sellerSDK.placeBid({
            taskId: taskId,
            price: "0.001",
            eta: 3600,
            meta: crypto.createHash('sha256').update("Will deliver in 1 hour").digest('hex')
        });
        console.log("✅ Bid PLACED.");

        // 7. Selection & Submission
        console.log("\n🎯 Step 6: Naruto Selecting Saske...");
        await buyerSDK.selectBid({ taskId, bidIndex: 0 });
        console.log("✅ Selection CONFIRMED.");

        console.log("\n🧪 Step 7: Saske Submitting Work...");
        const result = await sellerSDK.submitResult({
            taskId: taskId,
            hash: crypto.createHash('sha256').update("RESULT_DATA_123").digest('hex'),
            uri: "https://ipfs.io/ipfs/QmResult"
        });
        console.log(`✅ Result SUBMITTED: ${result.txId}`);

        // 8. Verification
        console.log("\n⚖️ Step 8: Itachi Verifying Work...");
        await verifierSDK.approveTask({ taskId });
        console.log("✅ Work APPROVED.");

        // 9. Finalization & Settlement
        console.log("\n💰 Step 9: Finalizing Task & Triggering Nano-Payout...");
        const final = await buyerSDK.finalizeTask({ taskId });
        console.log(`✅ Task FINALIZED: ${final.txId}`);

        console.log("\n🎉 SIMULATION COMPLETE: Sovereign P2P Lifecycle Verified.");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ [SIMULATION FAILED]:", e.message);
        if (e.response) console.error("Details:", JSON.stringify(e.response.data));
        process.exit(1);
    }
}

runSimulation();
