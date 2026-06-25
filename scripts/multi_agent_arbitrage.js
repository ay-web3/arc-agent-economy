import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
const TRADER_PORT = 8081;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function onboardAndFundAgent(agentName) {
    console.log(`>> Onboarding Agent: ${agentName}...`);
    const wResp = await axios.post(`${HUB_URL}/onboard`, { agentName });
    const { address, agentSecret } = wResp.data;
    console.log(`   ✅ Address: ${address}`);

    const dummyKey = "0x" + crypto.randomBytes(32).toString('hex');
    const gatewayClient = new GatewayClient({
        privateKey: dummyKey, gatewayAddress: GATEWAY_ADDR, chain: "arcTestnet"
    });

    const proxySign = async (typedData) => {
        if (!typedData.types.EIP712Domain) {
            typedData.types.EIP712Domain = [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" }
            ];
        }
        const serialized = JSON.stringify(typedData, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        const signResp = await axios.post(`${HUB_URL}/agent/sign-402`, {
            agentName, agentSecret, typedData: JSON.parse(serialized)
        });
        return signResp.data.signature;
    };

    gatewayClient.account = { address, signTypedData: proxySign };
    gatewayClient.batchScheme.signer.address = address;

    console.log(`   >> Waiting for auto-funding...`);
    await delay(5000);

    console.log(`   >> Depositing 10.00 USDC into Gateway (to cover Staking & Trading)...`);
    await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
        agentName, agentSecret, amount: "10.00"
    }, { timeout: 120000 });
    console.log(`   ✅ Deposit COMPLETE\n`);

    return { gatewayClient, address, agentSecret };
}

async function runA2ADemo() {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("🤖 A2A MULTI-AGENT ARBITRAGE DEMO");
    console.log("══════════════════════════════════════════════════════════════\n");

    // 1. Setup Trader Agent (Producer/Middleman)
    const traderName = "trader_agent_" + Date.now();
    const trader = await onboardAndFundAgent(traderName);

    // 2. Start Trader Agent Express Server
    const app = express();
    app.use(cors());
    app.use(express.json());

    const traderGatewayMw = createGatewayMiddleware({
        sellerAddress: trader.address,
        networks: ["eip155:5042002"],
        facilitatorUrl: "https://gateway-api-testnet.circle.com"
    });

    app.post('/api/service-8-signal', traderGatewayMw.require("0.10"), async (req, res) => {
        try {
            console.log(`\n   [TRADER AGENT] Received request from Consumer. Constructing signal...`);
            
            // Step A: Buy Crypto Data (Service 1)
            console.log(`   [TRADER AGENT] Purchasing Service 1 (Market Data) for 0.005 USDC...`);
            const s1Resp = await trader.gatewayClient.pay(`${HUB_URL}/api/crypto-insights?token=ethereum`, { method: "GET" });
            const ethPrice = s1Resp.data.price_usd;
            console.log(`      ✅ Received ETH Price: $${ethPrice}`);

            // Step B: Buy Sentiment Data (Service 5)
            console.log(`   [TRADER AGENT] Purchasing Service 5 (Sentiment) for 0.05 USDC...`);
            const s5Resp = await trader.gatewayClient.pay(`${HUB_URL}/api/polymarket/trending`, { method: "GET" });
            const trending = s5Resp.data.trending.slice(0,2).map(e => e.title).join(", ");
            console.log(`      ✅ Received Sentiment: "${trending.substring(0, 40)}..."`);

            // Step C: Buy LLM Reasoning (Service 3)
            const prompt = `You are a Trading Agent. The current ETH price is $${ethPrice}. Top Polymarket trends are: ${trending}. Based on this, generate a 2-sentence actionable trade signal for Ethereum.`;
            console.log(`   [TRADER AGENT] Purchasing Service 3 (LLM) for 0.015 USDC...`);
            const s3Resp = await trader.gatewayClient.pay(`${HUB_URL}/api/llm-reasoning`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const signal = s3Resp.data.reasoning;
            console.log(`      ✅ Received AI Signal: "${signal.substring(0, 50)}..."`);

            console.log(`   [TRADER AGENT] Returning final compiled Trade Signal to Consumer for 0.10 USDC (0.03 profit margin)!\n`);
            
            res.json({
                success: true,
                signal,
                components: { ethPrice, trending },
                cost_basis: 0.070,
                sale_price: 0.100,
                net_profit: 0.030
            });
        } catch (err) {
            console.error("   [TRADER AGENT] Error:", err.message);
            res.status(500).json({ error: "Trader processing failed" });
        }
    });

    const server = app.listen(TRADER_PORT, async () => {
        console.log(`>> Trader Agent Server running on http://localhost:${TRADER_PORT}`);
        try {
            console.log(`   >> Staking 5.00 USDC to Sovereign Hub to register A2A Service...`);
            const registerPayload = {
                name: "Trader Agent Alpha",
                url: `http://localhost:${TRADER_PORT}/api/service-8-signal`,
                price: 0.10,
                description: "High-accuracy A2A trade signal generation combining real-time Ethereum price ticks, Polymarket oracle sentiment, and Groq LLM inference."
            };
            
            await trader.gatewayClient.pay(`${HUB_URL}/api/registry/register`, {
                method: "POST",
                body: JSON.stringify(registerPayload),
                headers: { "Content-Type": "application/json" }
            });
            console.log(`   ✅ 5.00 USDC STAKED! Registered on the Sovereign Hub A2A Marketplace!\n`);
        } catch (err) {
            console.error(`   ❌ Failed to stake and register on Hub:`, err.message);
        }
    });

    // 3. Setup Consumer Agent
    const consumerName = "consumer_agent_" + Date.now();
    const consumer = await onboardAndFundAgent(consumerName);

    // 4. Consumer Buys from Trader Agent
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🤖 CONSUMER AGENT: BUYING SERVICE 8 (TRADE SIGNAL)");
    console.log(`   Price: 0.10 USDC | Target: Trader Agent`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        console.log(`   >> Sending payment and request to Trader Agent...`);
        const finalResp = await consumer.gatewayClient.pay(`http://localhost:${TRADER_PORT}/api/service-8-signal`, {
            method: "POST"
        });

        console.log(`\n   ✅ CONSUMER SUCCESSFULLY PURCHASED SIGNAL!`);
        console.log(`   💰 PAID: ${finalResp.formattedAmount} USDC`);
        console.log(`   📈 TRADE SIGNAL RECEIVED:\n      "${finalResp.data.signal}"\n`);

        console.log(`   >> Consumer simulating a malicious Sybil attack (Three 1-Star Ratings)...`);
        for (let i = 0; i < 3; i++) {
            const res = await axios.post(`${HUB_URL}/api/registry/rate`, {
                url: `http://localhost:${TRADER_PORT}/api/service-8-signal`,
                rating: 1
            });
            if (res.data.slashed) {
                console.log(`   🚨 SLASH EVENT DETECTED! ${res.data.message}`);
                console.log(`   💸 Trader Agent just lost its 5.00 USDC stake!`);
            } else {
                console.log(`   📉 Rating submitted: Average is now ${res.data.averageRating}`);
            }
        }
    } catch (err) {
        console.error(`   ❌ Consumer Failed: ${err.message}\n`);
    }

    console.log(">> Withdrawing remaining balances via Cooperative Close...\n");
    await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, { agentName: traderName, agentSecret: trader.agentSecret, amount: "0.05" }, { validateStatus: false });
    await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, { agentName: consumerName, agentSecret: consumer.agentSecret, amount: "0.05" }, { validateStatus: false });

    server.close();
    console.log("🎉 A2A DEMO COMPLETE\n");
}

runA2ADemo().catch(console.error);
