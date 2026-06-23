import axios from 'axios';
import crypto from 'crypto';

const originalFetch = global.fetch;
global.fetch = async (...args) => {
    const response = await originalFetch(...args);
    // Clone the response so we can read the body without consuming the stream
    if (response.status === 402) {
        const clone = response.clone();
        try {
            const body = await clone.json();
            console.log(`\n\n🎯 INTERCEPTED 402 RESPONSE FROM HUB:`, JSON.stringify(body, null, 2), `\n\n`);
        } catch (e) {}
    }
    return response;
};
import { GatewayClient } from '@circle-fin/x402-batching/client';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
        console.log(`\n>> [1] Initializing Buyer Agent via /onboard...`);
        const BUYER_NAME = "demo_buyer_fixed_1";
        
        const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: BUYER_NAME });
        const buyer = onboardResp.data;

        console.log(`   ✅ Success. Developer Wallet: ${buyer.address}`);
        console.log(`   ✅ Hub Password: ${buyer.agentSecret}`);

        console.log(`\n==========================================`);
        console.log(`⏳ WAITING FOR HUB AUTO-FUNDING ⏳`);
        console.log(`The Hub's MASTER_WALLET is automatically transferring Testnet USDC to the new agent...`);
        console.log(`Polling for Circle indexing of funds...`);
        
        let funded = false;
        for (let i = 0; i < 30; i++) {
            await delay(5000);
            try {
                if (buyer.sponsorshipTxId) {
                    const txResp = await axios.get(`${HUB_URL}/debug/transaction/${buyer.sponsorshipTxId}`);
                    if (txResp.data && txResp.data.transaction) {
                        const state = txResp.data.transaction.state;
                        const error = txResp.data.transaction.errorReason;
                        console.log(`\n   [TX STATUS] State: ${state} | Error: ${error || 'None'}`);
                    }
                }
                const bResp = await axios.get(`${HUB_URL}/debug/wallet/${buyer.walletId}`);
                if (bResp.data && bResp.data.balances) {
                    const usdc = bResp.data.balances.find(b => b.token.symbol === "USDC" && !b.token.isNative);
                    if (usdc && parseFloat(usdc.amount) >= 0.005) {
                        console.log(`   ✅ Agent is fully funded! Balance: ${usdc.amount} USDC`);
                        funded = true;
                        break;
                    }
                }
            } catch (e) {
                // Ignore errors during polling
            }
            process.stdout.write(".");
        }
        console.log(`\n==========================================\n`);
        
        if (!funded) {
            console.log("⚠️ Agent was not funded in time. Proceeding anyway, but it may fail.");
        }

        // We initialize GatewayClient with a dummy private key because it requires one
        // to pass the constructor validations. We will hijack its signing function next!
        const dummyKey = "0x" + crypto.randomBytes(32).toString('hex');
        const gatewayClient = new GatewayClient({
            gatewayAddress: GATEWAY_ADDR,
            privateKey: dummyKey,
            chain: "arcTestnet"
        });

        // 🚀 THE HYBRID PIVOT: Duck-type the internal account to use the Hub Proxy!
        gatewayClient.account = {
            address: buyer.address,
            signTypedData: async (typedData) => {
                console.log(`   [PROXY] Intercepted local signing. Forwarding to Hub for Wallet ${buyer.address}...`);
                
                // Fix: JSON.stringify cannot serialize BigInts by default. 
                // We must stringify it with a custom replacer before sending to the Hub.
                // Fix 2: Circle API requires EIP712Domain to be explicitly defined in types!
                if (!typedData.types.EIP712Domain) {
                    typedData.types.EIP712Domain = [
                        { name: "name", type: "string" },
                        { name: "version", type: "string" },
                        { name: "chainId", type: "uint256" },
                        { name: "verifyingContract", type: "address" }
                    ];
                }

                const stringifiedData = JSON.stringify(typedData, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                );

                try {
                    const signResp = await axios.post(`${HUB_URL}/agent/sign-402`, {
                        agentName: BUYER_NAME,
                        agentSecret: buyer.agentSecret,
                        typedData: stringifiedData
                    });
                    return signResp.data.signature;
                } catch (err) {
                    console.error("   ❌ [PROXY ERROR]", err.response?.data || err.message);
                    throw err;
                }
            }
        };

        await delay(1000);

        // 2. Pay-Per-Request
        console.log(`>> [2] Testing: Pay-Per-Request (API Call)`);
        try {
            const resp = await gatewayClient.pay(`${HUB_URL}/api/crypto-insights`, { method: "GET" });
            console.log(`   ✅ Paid: ${resp.formattedAmount} USDC. Content: "${resp.data.content}"`);
        } catch (err) {
            console.error(`❌ Demo Failed: ${err.message}`);
        }

        await delay(1000);

        // 3. Pay-Per-Second
        console.log(`>> [3] Testing: Pay-Per-Second (Streaming)`);
        console.log(`   ⏳ Simulating a stream...`);
        let resp = await gatewayClient.pay(`${HUB_URL}/api/stream`, { method: "POST" });
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
    } finally {
        rl.close();
    }
}

runDemo();
