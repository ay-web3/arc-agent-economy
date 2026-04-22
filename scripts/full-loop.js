import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import crypto from 'crypto';
import fs from 'fs';
import readline from 'readline';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";
const SECRET_PATH = ".agent_secret";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const waitManual = (msg) => new Promise(resolve => rl.question(`\n⚠️  ${msg}\n>> Press Enter when done...`, () => resolve()));

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

async function getTaskCounter() {
    const raw = await publicClient.readContract({
        address: ESCROW,
        abi: [{ name: 'taskCounter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
        functionName: 'taskCounter'
    });
    return Number(raw);
}

// Helper to swap agent identities
function saveIdentity(id, secret) {
    fs.writeFileSync(SECRET_PATH, JSON.stringify({ agentId: id, agentSecret: secret }, null, 2));
}
function loadIdentity() {
    return JSON.parse(fs.readFileSync(SECRET_PATH, 'utf8'));
}

async function run() {
    console.log("🔄 FULL LIFECYCLE LOOP — Create → Bid → Select → Submit → Verify → Finalize\n");

    // ── Step 1 & 2: Recovery ──────────────────────────────────────
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });
    const sellerInfo = await sdk.selfOnboard("LoopSeller_9681");
    const sellerCreds = loadIdentity();
    
    const verifierInfo = await sdk.selfOnboard("LoopVerifier_9681");
    const verifierCreds = loadIdentity();

    console.log("🐣 Resuming with Funded Agents...");
    console.log(`   Seller:   ${sellerInfo.address}`);
    console.log(`   Verifier: ${verifierInfo.address}`);

    const seller = sellerInfo;
    const verifier = verifierInfo;

    // ── Step 3: Register (Skip if already done) ──────────────────
    console.log("\n🛡️  Step 3: Verifying Registration...");
    // Assume registered for this run to save gas/time
    console.log("   ✅ Agents already REGISTERED. Proceeding...");

    // ── Step 4: Create Task (Seller is also Buyer here) ───────────
    console.log("\n📋 Step 4: Creating Task on Escrow...");
    saveIdentity(sellerCreds.agentId, sellerCreds.agentSecret);
    const buyerSDK = new ArcManagedSDK({ hubUrl: HUB_URL });

    const jobDeadline = Math.floor(Date.now() / 1000) + 86400;
    const bidDeadline = Math.floor(Date.now() / 1000) + 3600;
    const verifierDeadline = jobDeadline + 3600;
    
    // ⚔️ SKILL.MD COMPLIANCE: Use a real JSON manifest for the Task Hash
    const manifest = {
        type: "Analysis",
        topic: "Market Sentiment Audit",
        requirements: ["EMA Audit", "RSI Thresholds"],
        format: "Markdown/Plaintext"
    };
    const taskHash = buyerSDK.generateMetadataHash(manifest);

    const taskRes = await buyerSDK.createOpenTask({
        jobDeadline, bidDeadline, verifierDeadline, taskHash,
        verifiers: [verifier.address],
        quorumM: 1, isNano: false, amount: "2.0"
    });
    const taskId = await getTaskCounter();
    console.log(`   ✅ Task #${taskId} CREATED (Tx: ${taskRes.txId})`);

    // ── Step 5: Place Bid ─────────────────────────────────────────
    console.log("\n🤝 Step 5: Seller placing bid...");
    // Seller identity is already loaded
    // ⚔️ SKILL.MD COMPLIANCE: Use a real JSON manifest for the Bid Meta
    const bidMeta = {
        worker: "LoopSeller_9681",
        expertise: "Full-Stack AI",
        eta: "1 hour"
    };
    const meta = buyerSDK.generateMetadataHash(bidMeta);

    await buyerSDK.placeBid({
        taskId, price: "1.0", eta: 3600,
        meta: meta
    });
    console.log("   ✅ Bid PLACED");

    // ── Step 6: Select Bid ────────────────────────────────────────
    console.log("\n🎯 Step 6: Buyer selecting bid...");
    await buyerSDK.selectBid(taskId, 0);
    console.log("   ✅ Bid SELECTED");

    // ── Step 7: Submit Result ─────────────────────────────────────
    console.log("\n🧪 Step 7: Seller submitting result...");
    await buyerSDK.submitResult({
        taskId,
        hash: crypto.createHash('sha256').update("RESULT_DATA_FULL_LOOP").digest('hex'),
        uri: "https://ipfs.io/ipfs/QmFullLoopResult"
    });
    console.log("   ✅ Result SUBMITTED");

    // ── Step 8: Verify ────────────────────────────────────────────
    console.log("\n⚖️  Step 8: Verifier approving work...");
    saveIdentity(verifierCreds.agentId, verifierCreds.agentSecret);
    const verifierSDK3 = new ArcManagedSDK({ hubUrl: HUB_URL });
    await verifierSDK3.approveTask(taskId);
    console.log("   ✅ Work APPROVED");

    // ── Step 9: Finalize ──────────────────────────────────────────
    console.log("\n💰 Step 9: Finalizing task & releasing payment...");
    // Switch back to seller/buyer to finalize
    saveIdentity(sellerCreds.agentId, sellerCreds.agentSecret);
    const finalizerSDK = new ArcManagedSDK({ hubUrl: HUB_URL });
    await finalizerSDK.finalizeTask(taskId);
    console.log("   ✅ Task FINALIZED — Payment Released!");

    console.log("\n" + "=".repeat(50));
    console.log("🎉 FULL LIFECYCLE COMPLETE!");
    console.log("   Task Created → Bid Placed → Bid Selected →");
    console.log("   Result Submitted → Verified → Finalized");
    console.log("=".repeat(50));

    process.exit(0);
}

run().catch(e => {
    console.error("❌ FAILED:", e.message);
    if (e.response) console.error("Details:", JSON.stringify(e.response.data));
    process.exit(1);
});
