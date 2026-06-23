import axios from 'axios';
import crypto from 'crypto';

const HUB_URL = process.env.HUB_URL || "http://127.0.0.1:8080";
const BUYER_NAME = "Agent_Buyer_" + crypto.randomBytes(2).toString('hex');
const SELLER_ADDR = "0x" + crypto.randomBytes(20).toString('hex'); // Mock seller

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
    console.log("==========================================");
    console.log("🪙 UNIFIED MICRO-BILLING DEMO (Circle x402)");
    console.log("==========================================\n");

    try {
        // 1. Use Default Admin Buyer (bypasses MongoDB requirement for local testing)
        console.log(`>> [1] Using Admin Buyer Agent...`);
        const buyer = {
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026",
            address: "0xMockAdminAddress"
        };
        console.log(`   ✅ Success. Buyer Wallet: ${buyer.address}`);
        console.log(`   ✅ Buyer Secret: ${buyer.agentSecret}\n`);

        await delay(1000);

        // 2. Pay-Per-Request
        console.log(`>> [2] Testing: Pay-Per-Request (API Call)`);
        const reqResp = await axios.post(`${HUB_URL}/nano/charge/request`, {
            buyerName: buyer.agentName,
            buyerSecret: buyer.agentSecret,
            sellerAddress: SELLER_ADDR,
            amount: "0.005",
            endpoint: "/api/crypto-insights"
        });
        console.log(`   ✅ Queued: ${reqResp.data.amount} USDC via x402 Gateway. QueueId: ${reqResp.data.queueId}\n`);

        await delay(1000);

        // 3. Pay-Per-Second
        console.log(`>> [3] Testing: Pay-Per-Second (Streaming)`);
        console.log(`   ⏳ Simulating a 5-second stream...`);
        await delay(2000); // Wait briefly for demo effect
        const streamResp = await axios.post(`${HUB_URL}/nano/charge/stream`, {
            buyerName: buyer.agentName,
            buyerSecret: buyer.agentSecret,
            sellerAddress: SELLER_ADDR,
            seconds: 5,
            ratePerSecond: "0.0001"
        });
        console.log(`   ✅ Queued: ${streamResp.data.amount} USDC via x402 Gateway. QueueId: ${streamResp.data.queueId}\n`);

        await delay(1000);

        // 4. Pay-Per-Token
        console.log(`>> [4] Testing: Pay-Per-Token (LLM Reasoning)`);
        const payload = "The market is showing strong support at 145. Proceeding with accumulation strategy.";
        const tokenResp = await axios.post(`${HUB_URL}/nano/charge/token`, {
            buyerName: buyer.agentName,
            buyerSecret: buyer.agentSecret,
            sellerAddress: SELLER_ADDR,
            textPayload: payload,
            ratePerToken: "0.0005"
        });
        console.log(`   ✅ Generated ${tokenResp.data.tokens} tokens. Queued: ${tokenResp.data.amount} USDC. QueueId: ${tokenResp.data.queueId}\n`);

        await delay(1000);

        // 5. Pay-Per-Megabyte
        console.log(`>> [5] Testing: Pay-Per-Megabyte (Data Download)`);
        const dataResp = await axios.post(`${HUB_URL}/nano/charge/data`, {
            buyerName: buyer.agentName,
            buyerSecret: buyer.agentSecret,
            sellerAddress: SELLER_ADDR,
            bytesDownloaded: 15728640, // 15 MB
            ratePerMb: "0.002"
        });
        console.log(`   ✅ Downloaded ${dataResp.data.megabytes} MB. Queued: ${dataResp.data.amount} USDC. QueueId: ${dataResp.data.queueId}\n`);

        console.log("==========================================");
        console.log("🎉 All micro-payments successfully pushed to Circle x402 Batching Gateway!");
        console.log("==========================================");

    } catch (e) {
        console.error("❌ Demo Failed:", e.response ? e.response.data : e.message);
    }
}

runDemo();
