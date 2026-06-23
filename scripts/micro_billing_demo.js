import axios from 'axios';
import crypto from 'crypto';
import { GatewayClient } from '@circle-fin/x402-batching/client';

const HUB_URL = process.env.HUB_URL || "http://127.0.0.1:8080";
const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
    console.log("==========================================");
    console.log("🪙 UNIFIED MICRO-BILLING DEMO (Circle x402)");
    console.log("==========================================\n");

    try {
        console.log(`>> [1] Initializing Buyer Agent...`);
        // The agent needs a private key to sign its EIP-712 transfer authorizations
        const buyerSecret = process.env.CIRCLE_GATEWAY_PRIVATE_KEY || "0x" + crypto.randomBytes(32).toString('hex');
        
        // Initialize the true Gateway Client for the Agent
        const gatewayClient = new GatewayClient({
            gatewayAddress: GATEWAY_ADDR,
            privateKey: buyerSecret,
            chain: "arcTestnet"
        });

        await delay(1000);

        // 2. Pay-Per-Request
        console.log(`>> [2] Testing: Pay-Per-Request (API Call)`);
        let resp = await gatewayClient.pay(`${HUB_URL}/api/crypto-insights`, { method: "GET" });
        console.log(`   ✅ Paid: ${resp.formattedAmount} USDC. Content: "${resp.data.content}"`);

        await delay(1000);

        // 3. Pay-Per-Second
        console.log(`>> [3] Testing: Pay-Per-Second (Streaming)`);
        console.log(`   ⏳ Simulating a stream...`);
        resp = await gatewayClient.pay(`${HUB_URL}/api/stream`, { method: "POST" });
        console.log(`   ✅ Paid: ${resp.formattedAmount} USDC. Content: "${resp.data.content}"`);

        await delay(1000);

        // 4. Pay-Per-Token
        console.log(`>> [4] Testing: Pay-Per-Token (LLM Reasoning)`);
        resp = await gatewayClient.pay(`${HUB_URL}/api/llm-reasoning`, { method: "POST" });
        console.log(`   ✅ Paid: ${resp.formattedAmount} USDC. Content: "${resp.data.content}"`);

        await delay(1000);

        // 5. Pay-Per-Megabyte
        console.log(`>> [5] Testing: Pay-Per-Megabyte (Data Download)`);
        resp = await gatewayClient.pay(`${HUB_URL}/api/dataset`, { method: "POST" });
        console.log(`   ✅ Paid: ${resp.formattedAmount} USDC. Content: "${resp.data.content}"`);

        console.log("\n==========================================");
        console.log("🎉 All x402 402-Challenges met and batched successfully!");
        console.log("==========================================");

    } catch (e) {
        console.error("❌ Demo Failed:", e.message);
    }
}

runDemo();
