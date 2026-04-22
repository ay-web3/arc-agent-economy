import readline from 'readline';
import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, parseAbi } from 'viem';
import { arcTestnet } from 'viem/chains';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";
const REGISTRY = "0xcC95C81656c588ADbB1929ec42991124d746Ad21";
const SECRET_PATH = ".agent_secret";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise((resolve) => rl.question(query, resolve));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    console.log("🚀 STARTING FULL AGENT LIFECYCLE SIMULATION...");

    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });
    
    console.log("\n🔐 Onboarding Agent...");
    const identity = await sdk.getOrMintIdentity("AgentSimulation_123");
    console.log(`   ✅ Identity: ${identity.address}`);

    // Check stake
    const pc = createPublicClient({ chain: arcTestnet, transport: http() });
    const regAbi = parseAbi(['function isSeller(address) view returns (bool)', 'function isVerifier(address) view returns (bool)']);
    
    const isSeller = await pc.readContract({ address: REGISTRY, abi: regAbi, functionName: 'isSeller', args: [identity.address] });
    if (!isSeller) {
        console.log("   ⚠️ Agent not registered. Please fund and register manually if needed.");
    }

    console.log("\n📋 Step 1: Creating Task...");
    const jobDeadline = Math.floor(Date.now() / 1000) + 3600;
    const bidDeadline = Math.floor(Date.now() / 1000) + 600;
    const verifierDeadline = jobDeadline + 1800;
    const taskHash = "0x" + "1".repeat(64);

    const taskParams = {
        jobDeadline,
        bidDeadline,
        verifierDeadline,
        taskHash,
        verifiers: [], // Open to all
        quorumM: 1,
        amount: "2.0"
    };

    const res1 = await sdk.createOpenTask(taskParams);
    console.log(`   ✅ Task Created. Tx: ${res1.txId}`);
    
    const countRaw = await pc.readContract({
        address: ESCROW,
        abi: parseAbi(['function taskCounter() view returns (uint256)']),
        functionName: 'taskCounter'
    });
    const taskId = Number(countRaw);
    console.log(`   📌 Task ID: ${taskId}`);

    await sleep(3000);

    console.log("\n🤝 Step 2: Placing Bid...");
    const bidMeta = { worker: "SimAgent", speed: "Fast" };
    const metaHash = await sdk.generateMetadataHash(bidMeta);
    const bidRes = await sdk.placeBid({ taskId, price: "1.5", eta: 3600, meta: metaHash });
    console.log(`   ✅ Bid Placed. Tx: ${bidRes.txId}`);

    await sleep(3000);

    console.log("\n🎯 Step 3: Selecting Bid...");
    const selRes = await sdk.selectBid({ taskId, seller: identity.address });
    console.log(`   ✅ Bid Selected. Tx: ${selRes.txId}`);

    await sleep(3000);

    console.log("\n🧪 Step 4: Submitting Result...");
    const resultHash = "0x" + "2".repeat(64);
    const subRes = await sdk.submitResult({ taskId, resultHash, resultURI: "ipfs://test" });
    console.log(`   ✅ Result Submitted. Tx: ${subRes.txId}`);

    await sleep(3000);

    console.log("\n⚖️  Step 5: Approving (as Verifier)...");
    const appRes = await sdk.approveWork({ taskId });
    console.log(`   ✅ Work Approved. Tx: ${appRes.txId}`);

    console.log("\n🎉 SIMULATION COMPLETE!");
    rl.close();
}

run().catch(err => {
    console.error("\n❌ SIMULATION FAILED:");
    console.error(err);
    process.exit(1);
});
