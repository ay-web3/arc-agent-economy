import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import crypto from 'crypto';
import readline from 'readline';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const waitManual = (msg) => new Promise(resolve => rl.question(`\n⚠️ [MANUAL CHECKPOINT] ${msg}\n>> Press Enter when done to resume...`, () => resolve()));

async function runSoloSim() {
    console.log("🦊 Initiating Naruto Solo Mission...");
    
    // This will automatically load Naruto's secret from .agent_secret
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });
    const agentAddress = "0x02726977e7fd0452a6e5d471cb5c2387eb1fee60";

    console.log(`\nYour current active agent is Naruto: ${agentAddress}`);
    console.log("--------------------------------------------------");
    console.log("To create a task AND bid on it, Naruto must become a Seller.");
    console.log(`Please send 7.1 Native USDC to: ${agentAddress}`);
    console.log("(5.0 for Seller Stake + 2.0 for Task Reward + 0.1 for Gas)");
    console.log("--------------------------------------------------");

    await waitManual("Fund Naruto via your Faucet.");

    try {
        console.log("🛡️ Upgrading Naruto to Seller...");
        try {
            await sdk.registerAgent({
                asSeller: true,
                asVerifier: false,
                capabilities: "Shadow Clone Operations",
                amount: "5"
            });
            console.log("✅ Naruto is now a Registered Seller.");
        } catch (regErr) {
            console.log("⚠️ Registration failed (likely already a seller from previous run). Continuing...");
        }

        console.log("\n📋 Naruto is creating a Task...");
        const jobDeadline = Math.floor(Date.now() / 1000) + 86400;
        const bidDeadline = Math.floor(Date.now() / 1000) + 3600;
        const verifierDeadline = jobDeadline + 3600;
        const taskHash = crypto.createHash('sha256').update("Find Sasuke").digest('hex');
        
        // We need an array of verifiers. We will use a random address just to pass the contract requirement
        const fakeVerifier = "0xc064755512c3b530ac4b3041ac1e5df4fb06fbff"; // Itachi's old address

        const taskRes = await sdk.createOpenTask({
            jobDeadline,
            bidDeadline,
            verifierDeadline,
            taskHash,
            verifiers: [fakeVerifier],
            quorumM: 1,
            isNano: false,
            amount: "2.0"
        });
        console.log(`✅ Task CREATED! Tx: ${taskRes.txId}`);

        // Get the actual task ID directly from the blockchain
        const { createPublicClient, http } = await import('viem');
        const { arcTestnet } = await import('viem/chains');
        const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
        const taskIdRaw = await publicClient.readContract({
            address: '0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce',
            abi: [{ name: 'taskCounter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
            functionName: 'taskCounter'
        });
        const taskId = Number(taskIdRaw);
        console.log(`📌 On-chain Task ID: ${taskId}`);

        console.log(`\n🤝 Naruto is bidding on his own task (Task ${taskId})...`);
        const bidRes = await sdk.placeBid({
            taskId: taskId,
            price: "1.0",
            eta: 3600,
            meta: crypto.createHash('sha256').update("I will do it myself").digest('hex')
        });
        console.log(`✅ Bid PLACED! Tx: ${bidRes.txId}`);

        console.log("\n🎉 Solo Mission Complete!");

    } catch (e) {
        console.error("❌ Mission Failed:", e.message);
        if (e.response) console.error("Details:", JSON.stringify(e.response.data));
    }
    
    process.exit(0);
}

runSoloSim();
