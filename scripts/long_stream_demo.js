import axios from 'axios';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("💰 ARC LONG STREAM DEMO — 20 seconds live!");
    console.log("══════════════════════════════════════════════════════════════\n");

    const pkBytes = crypto.randomBytes(32);
    const BUYER_PK = `0x${pkBytes.toString('hex')}`;
    const account = privateKeyToAccount(BUYER_PK);
    const BUYER_NAME = `stream_buyer_${Date.now()}`;
    
    console.log(">> Onboarding buyer agent...");
    console.log(`   ✅ Agent:   ${BUYER_NAME}`);
    console.log(`   ✅ Address: ${account.address}\n`);

    const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() });
    
    const wResp = await axios.post(`${HUB_URL}/onboard`, {
        agentName: BUYER_NAME
    });
    
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
            agentName: BUYER_NAME,
            agentSecret: wResp.data.agentSecret,
            typedData: JSON.parse(serialized)
        });
        return signResp.data.signature;
    };

    gatewayClient.account = { address: wResp.data.address, signTypedData: proxySign };
    gatewayClient.batchScheme.signer.address = wResp.data.address;

    console.log(">> Waiting for Hub auto-funding...");
    await delay(5000);
    console.log("   ✅ Funded: 0.5 USDC\n");

    console.log(">> Depositing 0.45 USDC into Gateway...");
    const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
        agentName: BUYER_NAME, agentSecret: wResp.data.agentSecret, amount: "0.45"
    }, { timeout: 120000 });
    console.log(`   ✅ Approve: ${depositResp.data.approveState}`);
    console.log(`   ✅ Deposit: ${depositResp.data.depositState}\n`);

    let totalSpent = 0;

    // ── SERVICE 2: 10-SECOND ETH STREAM ──
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔴 SERVICE 2: Pay-Per-Second — Live Price Stream (ETHEREUM - 10 seconds)");
    console.log("   Price: 0.02 USDC/sec");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        console.log(`   >> Starting 10-second stream...`);
        const streamCost = 0.02 * 10; 
        
        // 1. Initial
        const initialResp = await fetch(`${HUB_URL}/api/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: "ethereum", seconds: 10 })
        });
        
        // 2. Receipt
        const paymentRequiredHeader = initialResp.headers.get("PAYMENT-REQUIRED");
        const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"));
        const batchingOption = paymentRequired.accepts.find(opt => opt.extra?.name === "GatewayWalletBatched");
        
        const paymentPayload = await gatewayClient.batchScheme.createPaymentPayload(
            paymentRequired.x402Version || 2, batchingOption
        );
        const paymentHeader = Buffer.from(JSON.stringify({
            ...paymentPayload, resource: paymentRequired.resource, accepted: batchingOption
        })).toString("base64");
        
        // 3. Stream using fetch
        const finalResp = await fetch(`${HUB_URL}/api/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Payment-Signature": paymentHeader },
            body: JSON.stringify({ token: "ethereum", seconds: 10 })
        });

        if (!finalResp.ok) throw new Error(`HTTP ${finalResp.status} - ${await finalResp.text()}`);

        totalSpent += streamCost;
        console.log(`   ✅ PAID ${streamCost.toFixed(4)} USDC up front for 10 seconds of streaming data.\n`);
        
        const reader = finalResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); 
            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.trim().substring(6));
                        console.log(`      [Tick ${data.tick}] $${data.price} (${data.change_pct > 0 ? '▲' : '▼'} ${data.change_pct}%)`);
                    } catch (e) {}
                }
            }
        }
        console.log(`\n   📡 Crypto Stream completed successfully.\n`);
    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
    }

    await delay(1000);

    // ── SERVICE 7: 10-SECOND POLYMARKET STREAM ──
    const targetEventId = "2893";
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 SERVICE 7: Arbitrage Orderbook Stream (10 seconds)");
    console.log(`   Event ID: ${targetEventId} | Price: 0.02 USDC/sec`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        console.log(`   >> Starting Polymarket stream...`);
        const streamCost = 0.02 * 10; 
        
        const initialResp = await fetch(`${HUB_URL}/api/polymarket/stream/${targetEventId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ duration_seconds: 10 })
        });
        
        const paymentRequiredHeader = initialResp.headers.get("PAYMENT-REQUIRED");
        const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"));
        const batchingOption = paymentRequired.accepts.find(opt => opt.extra?.name === "GatewayWalletBatched");
        
        const paymentPayload = await gatewayClient.batchScheme.createPaymentPayload(
            paymentRequired.x402Version || 2, batchingOption
        );
        const paymentHeader = Buffer.from(JSON.stringify({
            ...paymentPayload, resource: paymentRequired.resource, accepted: batchingOption
        })).toString("base64");
        
        const finalResp = await fetch(`${HUB_URL}/api/polymarket/stream/${targetEventId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Payment-Signature": paymentHeader },
            body: JSON.stringify({ duration_seconds: 10 })
        });

        if (!finalResp.ok) throw new Error(`HTTP ${finalResp.status} - ${await finalResp.text()}`);

        totalSpent += streamCost;
        console.log(`   ✅ PAID ${streamCost.toFixed(4)} USDC up front for 10 seconds of streaming data.\n`);
        
        const reader = finalResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop(); 
            for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.trim().substring(6));
                        console.log(`      [Tick ${data.tick}] Bid: ${data.bestBid} | Ask: ${data.bestAsk} | Spread: ${data.spread}`);
                    } catch (e) {}
                }
            }
        }
        console.log(`\n   📡 Polymarket Stream completed successfully.\n`);
    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
    }

    // ── PHASE 4: SELLER CASH-OUT ──
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 4: SELLER COOPERATIVE CLOSE       │");
    console.log("└─────────────────────────────────────────┘\n");

    console.log(`>> Withdrawing 0.05 USDC to Master Wallet via Cooperative Close...`);
    try {
        const wResp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, {
            agentName: "Admin", agentSecret: "SOVEREIGN_ADMIN_2026", amount: "0.05"
        }, { timeout: 60000 });
        console.log(`   ✅ gatewayMint TX: ${wResp.data.withdrawTxId}`);
    } catch (err) {
        console.error(`   ❌ Withdrawal Failed: ${err.response?.data?.error || err.message}\n`);
    }

    console.log("🎉 LONG STREAM DEMO COMPLETE");
}

run().catch(e => console.error("Fatal Error:", e));
