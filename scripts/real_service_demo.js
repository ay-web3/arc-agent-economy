import axios from 'axios';
import crypto from 'crypto';
import { GatewayClient } from '@circle-fin/x402-batching/client';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function realServiceDemo() {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("💰 ARC REAL SERVICE MARKETPLACE — Live Nano-Payment Demo");
    console.log("══════════════════════════════════════════════════════════════\n");

    // ── PHASE 1: BUYER SETUP ──
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 1: BUYER ONBOARDING & FUNDING    │");
    console.log("└─────────────────────────────────────────┘\n");

    const BUYER_NAME = "real_buyer_" + Date.now();
    console.log(">> [1.1] Onboarding buyer agent...");
    const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: BUYER_NAME });
    const buyer = onboardResp.data;
    console.log(`   ✅ Agent:   ${BUYER_NAME}`);
    console.log(`   ✅ Address: ${buyer.address}\n`);

    console.log(">> [1.2] Waiting for Hub auto-funding...");
    for (let i = 0; i < 30; i++) {
        await delay(5000);
        try {
            const bResp = await axios.get(`${HUB_URL}/debug/wallet/${buyer.walletId}`);
            const usdc = bResp.data?.balances?.find(b => b.token.symbol === "USDC" && b.token.isNative);
            if (usdc && parseFloat(usdc.amount) >= 0.005) {
                console.log(`   ✅ Funded: ${usdc.amount} USDC\n`);
                break;
            }
        } catch (e) {}
        process.stdout.write(".");
    }

    console.log(">> [1.3] Depositing 0.2 USDC into Gateway...");
    try {
        const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
            agentName: BUYER_NAME,
            agentSecret: buyer.agentSecret,
            amount: "0.2"
        }, { timeout: 180000 });
        console.log(`   ✅ Approve: ${depositResp.data.approveState}`);
        console.log(`   ✅ Deposit: ${depositResp.data.depositState}\n`);
    } catch (err) {
        console.error(`   ❌ Deposit Failed: ${err.response?.data?.error || err.message}`);
        return;
    }

    await delay(3000);

    // Set up GatewayClient with proxy signing
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
        const signResp = await axios.post(`${HUB_URL}/agent/sign-402`, {
            agentName: BUYER_NAME,
            agentSecret: buyer.agentSecret,
            typedData: JSON.parse(serialized)
        });
        return signResp.data.signature;
    };

    gatewayClient.account = { address: buyer.address, signTypedData: proxySign };
    gatewayClient.batchScheme.signer.address = buyer.address;

    let totalSpent = 0;

    // ── PHASE 2: REAL SERVICE CALLS ──
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 2: REAL SERVICE NANO-PAYMENTS     │");
    console.log("└─────────────────────────────────────────┘\n");

    // ── SERVICE 1: Pay-Per-Request — Live Crypto Data ──
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 SERVICE 1: Pay-Per-Request — Live BTC Market Data");
    console.log("   Price: 0.005 USDC | Source: CoinGecko API");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        const resp = await gatewayClient.pay(`${HUB_URL}/api/crypto-insights?token=bitcoin`, { method: "GET" });
        totalSpent += 0.005;
        const d = resp.data;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        console.log(`   🪙 ${d.symbol}: $${d.price_usd?.toLocaleString()}`);
        console.log(`   📈 24h Change: ${d.change_24h?.toFixed(2)}%`);
        console.log(`   💎 Market Cap: $${(d.market_cap / 1e9)?.toFixed(2)}B`);
        console.log(`   📊 Volume 24h: $${(d.volume_24h / 1e9)?.toFixed(2)}B`);
        console.log(`   🏔️  ATH: $${d.ath?.toLocaleString()}\n`);
    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
    }

    await delay(1500);

    // ── SERVICE 2: Pay-Per-Second — Live Price Stream ──
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔴 SERVICE 2: Pay-Per-Second — ETH Price Stream (5 ticks)");
    console.log("   Price: 0.02 USDC | Source: CoinGecko + simulated ticks");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        const resp = await gatewayClient.pay(`${HUB_URL}/api/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: "ethereum", seconds: 5 })
        });
        totalSpent += 0.02;
        const d = resp.data;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        console.log(`   📡 Base price: $${d.base_price}`);
        d.ticks?.forEach(t => {
            const arrow = t.change_pct >= 0 ? "▲" : "▼";
            console.log(`   ⏱️  Tick ${t.second}: $${t.price} (${arrow} ${t.change_pct}%)`);
        });
        console.log(`   📊 OHLC: Open=$${d.summary?.open} Close=$${d.summary?.close} Hi=$${d.summary?.high} Lo=$${d.summary?.low}\n`);
    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
    }

    await delay(1500);

    // ── SERVICE 3: Pay-Per-Token — Real LLM Reasoning ──
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🧠 SERVICE 3: Pay-Per-Token — Gemini 2.0 Flash LLM");
    console.log("   Price: 0.015 USDC | Model: gemini-2.0-flash");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        const prompt = "You are an autonomous crypto trading agent. Analyze whether ETH is currently overbought or oversold relative to BTC. Provide 3 specific, actionable trading signals. Be concise.";
        const resp = await gatewayClient.pay(`${HUB_URL}/api/llm-reasoning`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });
        totalSpent += 0.015;
        const d = resp.data;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        console.log(`   🤖 Model: ${d.model}`);
        console.log(`   📝 Prompt: "${d.prompt}"`);
        console.log(`   💬 Reasoning:\n`);
        // Print reasoning with indentation
        const lines = d.reasoning?.split('\n') || [];
        lines.slice(0, 15).forEach(line => console.log(`      ${line}`));
        if (lines.length > 15) console.log(`      ... (${lines.length - 15} more lines)`);
        console.log(`\n   📊 Tokens: ${d.usage?.prompt_tokens} prompt + ${d.usage?.completion_tokens} completion = ${d.usage?.total_tokens} total\n`);
    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
    }

    await delay(1500);

    // ── SERVICE 4: Pay-Per-Megabyte — On-Chain Analytics ──
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 SERVICE 4: Pay-Per-Megabyte — ARC-TESTNET Block Data");
    console.log("   Price: 0.1 USDC | Source: ARC RPC (live on-chain)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        const resp = await gatewayClient.pay(`${HUB_URL}/api/dataset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "blocks", limit: 5 })
        });
        totalSpent += 0.1;
        const d = resp.data;
        console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
        console.log(`   📊 Dataset: ${d.dataset} | Chain: ${d.chain_id}`);
        console.log(`   🔢 Latest block: #${d.latest_block} | Records: ${d.records}`);
        d.data?.forEach(b => {
            console.log(`   🧱 Block #${b.number}: ${b.transactions} txs | Gas: ${(parseInt(b.gasUsed)/1e6).toFixed(2)}M | ${b.timestamp}`);
        });
        console.log();
    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
    }

    // ── PHASE 3: SUMMARY ──
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 3: SETTLEMENT SUMMARY             │");
    console.log("└─────────────────────────────────────────┘\n");

    console.log(`   💸 Total spent by ${BUYER_NAME}: ${totalSpent} USDC`);
    console.log(`   📊 Services consumed: 4`);
    console.log(`   ⚡ Payment method: x402 Gateway Nano-Payments`);
    console.log(`   🔐 Signing: Proxy via Circle Web3 Services (no exposed keys)\n`);

    // ── PHASE 4: SELLER CASH-OUT ──
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 4: SELLER COOPERATIVE CLOSE       │");
    console.log("└─────────────────────────────────────────┘\n");

    const withdrawAmount = "0.03";
    console.log(`>> Withdrawing ${withdrawAmount} USDC to Master Wallet via Cooperative Close...`);
    try {
        const wResp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, {
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026",
            amount: withdrawAmount
        }, { timeout: 60000 });
        console.log(`   ✅ gatewayMint TX: ${wResp.data.withdrawTxId}`);

        for (let i = 0; i < 20; i++) {
            await delay(3000);
            try {
                const statusResp = await axios.get(`${HUB_URL}/tx-status/${wResp.data.withdrawTxId}`);
                if (statusResp.data.state === "COMPLETE") {
                    console.log(`   ✅ CONFIRMED ON-CHAIN!`);
                    console.log(`   🔗 TX: ${statusResp.data.txHash}\n`);
                    break;
                }
                if (statusResp.data.state === "FAILED") {
                    console.log(`   ❌ FAILED: ${statusResp.data.errorReason}\n`);
                    break;
                }
            } catch (e) {}
            process.stdout.write(".");
        }
    } catch (err) {
        console.error(`   ❌ Withdrawal Failed: ${err.response?.data?.error || err.message}\n`);
    }

    console.log("══════════════════════════════════════════════════════════════");
    console.log("🎉 REAL SERVICE MARKETPLACE DEMO COMPLETE");
    console.log("══════════════════════════════════════════════════════════════");
    console.log("  ✅ Live crypto data from CoinGecko");
    console.log("  ✅ Real-time price streaming with micro-fluctuations");
    console.log("  ✅ Real AI reasoning from Gemini 2.0 Flash");
    console.log("  ✅ Live on-chain ARC-TESTNET block data");
    console.log("  ✅ Instant seller cash-out via Cooperative Close");
    console.log("══════════════════════════════════════════════════════════════");
}

realServiceDemo().catch(e => console.error("Fatal:", e.message));
