import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

/**
 * ⚡ NANO-PAYMENT LIFECYCLE SIMULATION ⚡
 * 
 * Demonstrates Option B & C:
 * - isNano: true (Skips native transfers, emits events)
 * - Ultra-low 0.0001 USDC amount
 */

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";
const REGISTRY = "0xcC95C81656c588ADbB1929ec42991124d746Ad21";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    console.log("⚡ NANO-PAYMENT LIFECYCLE SIMULATION ⚡\n");

    const sellerSDK = new ArcManagedSDK({ hubUrl: HUB_URL });
    const verifierSDK = new ArcManagedSDK({ hubUrl: HUB_URL });

    console.log("[SDK] Secure Onboarding & Identity Minting for: LoopSeller_9681");
    const seller = await sellerSDK.getOrMintIdentity("LoopSeller_9681");
    
    console.log("[SDK] Secure Onboarding & Identity Minting for: LoopVerifier_9681");
    const verifier = await verifierSDK.getOrMintIdentity("LoopVerifier_9681");

    console.log("🐣 Agents Recovered...");
    console.log(`   Seller:   ${seller.address}`);
    console.log(`   Verifier: ${verifier.address}`);

    // ── Step 1: Create Nano Task ───
    console.log("\n📋 Step 1: Creating Nano Task on Escrow...");
    const jobDeadline = Math.floor(Date.now() / 1000) + 7200;
    const bidDeadline = Math.floor(Date.now() / 1000) + 1200;
    const verifierDeadline = jobDeadline + 3600;
    const taskHash = "0x" + "a".repeat(64);

    const taskParams = {
        jobDeadline,
        bidDeadline,
        verifierDeadline,
        taskHash,
        verifiers: [verifier.address],
        quorumM: 1,
        amount: "0.0001", // ⚡ TRUE MICRO-PAYMENT ⚡
        isNano: true   
    };

    const res1 = await sellerSDK.createOpenTask(taskParams);
    console.log(`   ✅ Nano Task CREATED. Tx: ${res1.txId}`);
    
    const { createPublicClient, http, parseAbi } = await import('viem');
    const { arcTestnet } = await import('viem/chains');
    const pc = createPublicClient({ chain: arcTestnet, transport: http() });
    
    const countRaw = await pc.readContract({
        address: ESCROW,
        abi: parseAbi(['function taskCounter() view returns (uint256)']),
        functionName: 'taskCounter'
    });
    const taskId = Number(countRaw); 
    console.log(`   📌 Task ID: ${taskId}`);

    await sleep(3000);

    // ── Step 2: Place Bid ───────────
    console.log("\n🤝 Step 2: Seller placing bid...");
    const bidMeta = {
        worker: "LoopSeller_9681",
        expertise: "Data Analysis",
        eta: "1 hour"
    };
    const metaHash = await sellerSDK.generateMetadataHash(bidMeta);

    const bidParams = {
        taskId: taskId,
        price: "0.00005", // Half of total (rest is verifier pool)
        eta: 3600,
        meta: metaHash
    };

    const bidRes = await sellerSDK.placeBid(bidParams);
    console.log(`   ✅ Bid PLACED. Tx: ${bidRes.txId}`);

    await sleep(3000);

    // ── Step 3: Select Bid ──────────
    console.log("\n🎯 Step 3: Selecting bid...");
    // In this simulation, the sellerSDK acts as the buyer for step 1 & 3
    const selRes = await sellerSDK.selectBid({
        taskId: taskId,
        seller: seller.address
    });
    console.log(`   ✅ Bid SELECTED. Tx: ${selRes.txId}`);

    await sleep(3000);

    // ── Step 4: Submit Result ───────
    console.log("\n🧪 Step 4: Seller submitting result...");
    const resultHash = "0x" + "b".repeat(64);
    const subRes = await sellerSDK.submitResult({
        taskId: taskId,
        resultHash,
        resultURI: "ipfs://nano-result"
    });
    console.log(`   ✅ Result SUBMITTED. Tx: ${subRes.txId}`);

    await sleep(3000);

    // ── Step 5: Verify & Approve ────
    console.log("\n⚖️  Step 5: Verifier approving work...");
    const appRes = await verifierSDK.approveWork({
        taskId: taskId
    });
    console.log(`   ✅ Work APPROVED. Tx: ${appRes.txId}`);

    console.log("\n🎉 NANO-TASK APPROVED! ⏳ Now entering 1-hour cooling-off period.");
    console.log("After 1 hour, calling finalize() will emit NanoSettlementAuthorized events instead of native transfers.");
    console.log("These events will trigger the off-chain Keeper to call Hub's /payout/nano endpoint.");
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
