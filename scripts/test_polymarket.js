import { GatewayClient } from '@circle-fin/x402-batching/client';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const ADMIN_ADDRESS = "0xabc3afc19fa3d0123bd45e418bb39cf23dd5964d";
const dummyKey = "0x" + crypto.randomBytes(32).toString('hex');
const gatewayClient = new GatewayClient({
    gatewayAddress: GATEWAY_ADDR,
    privateKey: dummyKey,
    chain: "arcTestnet"
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
    const resp = await fetch(`${HUB_URL}/agent/sign-402`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026",
            typedData: JSON.parse(serialized)
        })
    });
    const data = await resp.json();
    return data.signature;
};

gatewayClient.account = { address: ADMIN_ADDRESS, signTypedData: proxySign };
gatewayClient.batchScheme.signer.address = ADMIN_ADDRESS;

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function run() {
    console.log("==========================================");
    console.log("   TESTING POLYMARKET NANO-PAYMENTS");
    console.log("==========================================\n");

    let totalSpent = 0;
    let targetEventId = null;

    // 1. Trending
    console.log(">> Fetching Trending Sentiment (0.05 USDC)...");
    try {
        const resp = await gatewayClient.pay(`${HUB_URL}/api/polymarket/trending`, { method: "GET" });
        totalSpent += 0.05;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        resp.data.trending.forEach((e, i) => console.log(`      ${i+1}. ${e.title} ($${Math.round(e.volume)})`));
        if (resp.data.trending.length > 0) targetEventId = resp.data.trending[0].id;
    } catch (e) {
        console.error("   ❌ Error:", e.message);
    }

    if (!targetEventId) return;
    await delay(1500);

    // 2. Probability Oracle
    console.log(`\n>> Fetching Probability Oracle for Event ${targetEventId} (0.01 USDC)...`);
    try {
        const resp = await gatewayClient.pay(`${HUB_URL}/api/polymarket/probability/${targetEventId}`, { method: "GET" });
        totalSpent += 0.01;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        console.log(`   Event: ${resp.data.title}`);
        if (resp.data.outcomes) {
            resp.data.outcomes.forEach((o, i) => {
                console.log(`   - ${o}: ${parseFloat(resp.data.probabilities[i]) * 100}%`);
            });
        }
    } catch (e) {
        console.error("   ❌ Error:", e.message);
    }

    await delay(1500);

    // 3. Stream
    console.log(`\n>> Starting Orderbook Stream for 3 seconds (0.06 USDC)...`);
    try {
        const resp = await gatewayClient.pay(`${HUB_URL}/api/polymarket/stream/${targetEventId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration_seconds: 3 }),
            responseType: "stream"
        });
        totalSpent += 0.06;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        await new Promise((resolve) => {
            resp.data.on('data', chunk => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const d = JSON.parse(line.substring(6));
                        console.log(`      Tick ${d.tick}: Bid ${d.bestBid} | Ask ${d.bestAsk} | Spread: ${d.spread}`);
                    }
                }
            });
            resp.data.on('end', resolve);
        });
    } catch (e) {
        console.error("   ❌ Error:", e.message);
    }

    console.log(`\n✅ TEST COMPLETE. Total Admin Wallet Spend: ${totalSpent} USDC`);
}

run();
