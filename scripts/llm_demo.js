import axios from 'axios';
import crypto from 'crypto';
import { GatewayClient } from '@circle-fin/x402-batching/client';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function runLlmDemo() {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("🧠 ARC LLM REASONING DEMO");
    console.log("══════════════════════════════════════════════════════════════\n");

    const BUYER_NAME = "llm_agent_" + Date.now();
    console.log(">> Onboarding LLM agent...");
    
    const wResp = await axios.post(`${HUB_URL}/onboard`, {
        agentName: BUYER_NAME
    });
    
    console.log(`   ✅ Agent:   ${wResp.data.agentName}`);
    console.log(`   ✅ Address: ${wResp.data.address}\n`);

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

    const prompts = [
        "You are an autonomous crypto trading agent. Analyze whether ETH is currently overbought or oversold relative to BTC. Provide 3 specific, actionable trading signals. Be concise.",
        "As an AI running on a Sovereign Hub, explain the benefits of using off-chain micro-transactions via the Circle X402 Gateway compared to standard on-chain payments.",
        "What are the primary risks associated with high-frequency prediction market arbitrage, and how can an autonomous agent mitigate them?"
    ];

    for (let i = 0; i < prompts.length; i++) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🧠 SERVICE 3: LLM Reasoning Request #${i + 1}`);
        console.log(`   Price: 0.015 USDC | Model: llama-3.1-8b-instant`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        try {
            console.log(`   >> Sending prompt: "${prompts[i].substring(0, 50)}..."`);
            const resp = await gatewayClient.pay(`${HUB_URL}/api/llm-reasoning`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompts[i] })
            });

            const d = resp.data;
            totalSpent += 0.015;
            console.log(`   ✅ PAID ${resp.formattedAmount} USDC`);
            console.log(`   🧠 Model: ${d.model}`);
            console.log(`   💭 Reasoning:\n`);
            
            const lines = d.reasoning?.split('\n') || [];
            lines.forEach(line => console.log(`      ${line}`));
            
            console.log(`\n   📊 Tokens: ${d.usage?.prompt_tokens} prompt + ${d.usage?.completion_tokens} completion = ${d.usage?.total_tokens} total\n`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}\n`);
        }
        await delay(2000);
    }

    console.log("┌─────────────────────────────────────────┐");
    console.log("│  PHASE 4: SELLER COOPERATIVE CLOSE      │");
    console.log("└─────────────────────────────────────────┘\n");

    console.log(">> Withdrawing remaining 0.05 USDC to Master Wallet via Cooperative Close...");
    const withdrawResp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, {
        agentName: "Admin", 
        agentSecret: "SOVEREIGN_ADMIN_2026", 
        amount: "0.05"
    }, { timeout: 60000 });
    console.log(`   ✅ gatewayMint TX: ${withdrawResp.data.withdrawTxId}`);
    
    console.log("🎉 LLM DEMO COMPLETE\n");
}

runLlmDemo().catch(console.error);
