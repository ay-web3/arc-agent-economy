import axios from 'axios';
import crypto from 'crypto';
import { GatewayClient } from '@circle-fin/x402-batching/client';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function serviceEconomyLoop() {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("💰 ARC SERVICE ECONOMY — Full Nano-Payment Loop");
    console.log("══════════════════════════════════════════════════════════════");
    console.log("  Buyer Agent  →  pays for 4 services  →  Seller receives");
    console.log("  Seller (Master Wallet)  →  Cooperative Close  →  Instant cash out");
    console.log("══════════════════════════════════════════════════════════════\n");

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: BUYER SETUP
    // ═══════════════════════════════════════════════════════════════
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 1: BUYER ONBOARDING & FUNDING    │");
    console.log("└─────────────────────────────────────────┘\n");

    const BUYER_NAME = "service_buyer_" + Date.now();
    console.log(">> [1.1] Onboarding buyer agent...");
    const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: BUYER_NAME });
    const buyer = onboardResp.data;
    console.log(`   ✅ Agent:   ${BUYER_NAME}`);
    console.log(`   ✅ Address: ${buyer.address}`);
    console.log(`   ✅ Wallet:  ${buyer.walletId}\n`);

    // Wait for auto-funding
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

    // Deposit into Gateway
    console.log(">> [1.3] Depositing 0.2 USDC into GatewayWallet...");
    console.log("   (2 on-chain txs: approve + deposit)\n");
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

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: NANO-PAYMENTS — 4 SERVICE TYPES
    // ═══════════════════════════════════════════════════════════════
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 2: PAY-PER-USE NANO-PAYMENTS     │");
    console.log("└─────────────────────────────────────────┘\n");

    // Set up GatewayClient with proxy signing (DCW can't expose private keys)
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

    // Track total spent
    let totalSpent = 0;

    const services = [
        {
            name: "Pay-Per-Request (Crypto Insights API)",
            endpoint: "/api/crypto-insights",
            method: "GET",
            price: 0.005,
            emoji: "📊"
        },
        {
            name: "Pay-Per-Second (Live Streaming)",
            endpoint: "/api/stream",
            method: "POST",
            price: 0.02,
            emoji: "🔴"
        },
        {
            name: "Pay-Per-Token (LLM Reasoning)",
            endpoint: "/api/llm-reasoning",
            method: "POST",
            price: 0.015,
            emoji: "🧠"
        },
        {
            name: "Pay-Per-Megabyte (Dataset Download)",
            endpoint: "/api/dataset",
            method: "POST",
            price: 0.1,
            emoji: "📦"
        }
    ];

    for (const svc of services) {
        console.log(`>> ${svc.emoji} ${svc.name}  —  ${svc.price} USDC`);
        try {
            const resp = await gatewayClient.pay(`${HUB_URL}${svc.endpoint}`, { method: svc.method });
            totalSpent += svc.price;
            const preview = JSON.stringify(resp.data).substring(0, 80);
            console.log(`   ✅ Paid ${resp.formattedAmount} USDC`);
            console.log(`   📦 Response: ${preview}...\n`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}\n`);
        }
        await delay(1000);
    }

    console.log(`   ──────────────────────────────────────`);
    console.log(`   💸 Total spent by buyer: ${totalSpent} USDC`);
    console.log(`   ──────────────────────────────────────\n`);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: SELLER WITHDRAWAL — Cooperative Close
    // ═══════════════════════════════════════════════════════════════
    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 3: SELLER INSTANT CASH-OUT       │");
    console.log("└─────────────────────────────────────────┘\n");

    // Check Master Wallet balance before withdrawal
    console.log(">> [3.1] Checking Master Wallet USDC balance BEFORE...");
    let balanceBefore = 0;
    try {
        const masterResp = await axios.get(`${HUB_URL}/debug/master`);
        const usdc = masterResp.data?.balances?.find(b => b.token?.isNative);
        balanceBefore = parseFloat(usdc?.amount || "0");
        console.log(`   💰 Master Wallet: ${usdc?.amount} USDC\n`);
    } catch (e) {
        console.log(`   Could not check: ${e.message}\n`);
    }

    // Withdraw earned revenue
    const withdrawAmount = "0.03"; // withdraw a portion of the 0.14 earned
    console.log(`>> [3.2] Cooperative Close: withdrawing ${withdrawAmount} USDC for Master Wallet...`);
    try {
        const wResp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, {
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026",
            amount: withdrawAmount
        }, { timeout: 60000 });
        console.log(`   ✅ Attestation received!`);
        console.log(`   ✅ gatewayMint TX: ${wResp.data.withdrawTxId}`);
        console.log(`   ⏳ State: ${wResp.data.state}\n`);

        // Wait for on-chain confirmation
        console.log(">> [3.3] Waiting for on-chain confirmation...");
        for (let i = 0; i < 20; i++) {
            await delay(3000);
            try {
                const statusResp = await axios.get(`${HUB_URL}/tx-status/${wResp.data.withdrawTxId}`);
                if (statusResp.data.state === "COMPLETE") {
                    console.log(`   ✅ CONFIRMED!`);
                    console.log(`   🔗 TX Hash: ${statusResp.data.txHash}\n`);
                    break;
                } else if (statusResp.data.state === "FAILED") {
                    console.log(`   ❌ FAILED: ${statusResp.data.errorReason}\n`);
                    break;
                }
            } catch (e) {}
            process.stdout.write(".");
        }

        // Check balance after
        console.log(">> [3.4] Checking Master Wallet USDC balance AFTER...");
        try {
            // Wait a moment for Circle indexer
            await delay(5000);
            const masterResp = await axios.get(`${HUB_URL}/debug/master`);
            const usdc = masterResp.data?.balances?.find(b => b.token?.isNative);
            const balanceAfter = parseFloat(usdc?.amount || "0");
            const delta = balanceAfter - balanceBefore;
            console.log(`   💰 Master Wallet: ${usdc?.amount} USDC`);
            console.log(`   📈 Change: +${delta.toFixed(6)} USDC (${withdrawAmount} minted − gas)\n`);
        } catch (e) {
            console.log(`   Could not check: ${e.message}\n`);
        }

    } catch (err) {
        console.error(`   ❌ Withdrawal Failed: ${err.response?.data?.error || err.message}\n`);
    }

    // ═══════════════════════════════════════════════════════════════
    console.log("══════════════════════════════════════════════════════════════");
    console.log("🎉 SERVICE ECONOMY LOOP COMPLETE");
    console.log("══════════════════════════════════════════════════════════════");
    console.log(`  Buyer paid ${totalSpent} USDC across 4 service types`);
    console.log(`  Seller withdrew ${withdrawAmount} USDC instantly via Cooperative Close`);
    console.log(`  Zero intermediaries. Zero delays. Pure agent commerce.`);
    console.log("══════════════════════════════════════════════════════════════");
}

serviceEconomyLoop().catch(e => console.error("Fatal:", e.message));
