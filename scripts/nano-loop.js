import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("⚡ NANO-PAYMENT LIFECYCLE SIMULATION ⚡\n");

    const sellerSDK = new ArcManagedSDK({ hubUrl: HUB_URL });
    const verifierSDK = new ArcManagedSDK({ hubUrl: HUB_URL });
    
    // Recover agents
    const seller = await sellerSDK.selfOnboard("LoopSeller_9681");
    const verifier = await verifierSDK.selfOnboard("LoopVerifier_9681");

    console.log("🐣 Agents Recovered...");
    console.log(`   Seller:   ${seller.address}`);
    console.log(`   Verifier: ${verifier.address}`);

    // ── Step 1: Create Nano Task ───────────
    console.log("\n📋 Step 1: Creating Nano Task on Escrow...");

    const jobDeadline = Math.floor(Date.now() / 1000) + 86400;
    const bidDeadline = Math.floor(Date.now() / 1000) + 3600;
    const verifierDeadline = jobDeadline + 3600;
    
    const manifest = {
        type: "Micro-Analysis",
        topic: "Quick Social Sentiment",
        requirements: ["Positive/Negative ratio"],
        format: "JSON"
    };

    const taskHash = await sellerSDK.generateMetadataHash(manifest);

    const taskParams = {
        jobDeadline,
        bidDeadline,
        verifierDeadline,
        taskHash,
        verifiers: [verifier.address],
        quorumM: 1,
        amount: "2.0", // Minimum limits still apply (1.5 USDC min)
        isNano: true   // ⚡ FLAG FOR NANO-SETTLEMENT ⚡
    };

    const res1 = await sellerSDK.createOpenTask(taskParams);
    console.log(`   ✅ Nano Task CREATED. Tx: ${res1.txId}`);
    
    const { createPublicClient, http, parseAbi } = await import('viem');
    const { arcTestnet } = await import('viem/chains');
    const pc = createPublicClient({ chain: arcTestnet, transport: http() });
    
    const countRaw = await pc.readContract({
        address: "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce",
        abi: parseAbi(['function taskCounter() view returns (uint256)']),
        functionName: 'taskCounter'
    });
    const taskId = Number(countRaw); // Most recent task
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
        price: "1.0",
        eta: 3600,
        meta: metaHash
    };

    const res2 = await sellerSDK.placeBid(bidParams);
    console.log(`   ✅ Bid PLACED. Tx: ${res2.txId}`);

    await sleep(3000);

    // ── Step 3: Select Bid ───────────
    console.log("\n🎯 Step 3: Buyer selecting bid...");
    const res3 = await sellerSDK.selectBid(taskId, 0); // Assuming first bid
    console.log(`   ✅ Bid SELECTED. Tx: ${res3.txId}`);

    await sleep(3000);

    // ── Step 4: Submit Result ───────────
    console.log("\n🧪 Step 4: Seller submitting result...");
    const resHash = await sellerSDK.generateMetadataHash({ result: "Positive: 80%, Negative: 20%" });
    const res4 = await sellerSDK.submitResult({
        taskId: taskId,
        hash: resHash,
        uri: "ipfs://QmMicroResultHash..."
    });
    console.log(`   ✅ Result SUBMITTED. Tx: ${res4.txId}`);

    await sleep(3000);

    // ── Step 5: Approve Work ───────────
    console.log("\n⚖️  Step 5: Verifier approving work...");
    const res5 = await verifierSDK.approveTask(taskId);
    console.log(`   ✅ Work APPROVED. Tx: ${res5.txId}`);

    console.log("\n🎉 NANO-TASK APPROVED! ⏳ Now entering 1-hour cooling-off period.");
    console.log("After 1 hour, calling finalize() will emit NanoSettlementAuthorized events instead of native transfers.");
    console.log("These events will trigger the off-chain Keeper to call Hub's /payout/nano endpoint.");
}

run().catch(console.error);
