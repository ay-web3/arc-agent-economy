import { GatewayClient } from '@circle-fin/x402-batching/client';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function runAgentSkill() {
    console.log("=== AGENT INITIALIZATION ===");
    
    // STEP 1: Onboard to get a wallet
    console.log("\n[Phase 1] Calling POST /onboard...");
    const onboardReq = await fetch("https://arc-agent-economy.onrender.com/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: "Protocol Agent" })
    });
    const onboardData = await onboardReq.json();
    if (!onboardData.success) return console.error("Failed to onboard.");
    
    const { agentName, agentSecret, address } = onboardData;
    console.log("Success. Address:", address);
    
    console.log("\n[Phase 1b] Waiting 15s for Hub to fund wallet on blockchain...");
    await delay(15000);
    
    // STEP 2: Gateway Deposit
    console.log("\n[Phase 2] Attempting Gateway Deposit of 0.005 USDC...");
    const depositReq = await fetch("https://arc-agent-economy.onrender.com/agent/gateway-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, agentSecret, amount: "0.005" })
    });
    const depositData = await depositReq.json();
    console.log("Deposit Response:", depositData.depositState);
    
    console.log("Waiting 5 seconds for deposit settlement...");
    await delay(5000);

    // STEP 3: Execution Protocol (x402 via SDK)
    console.log("\n[Phase 3] Initializing GatewayClient with proxy signer...");
    
    const proxySign = async (typedData) => {
        if (!typedData.types.EIP712Domain) {
            typedData.types.EIP712Domain = [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" }
            ];
        }
        const response = await fetch("https://arc-agent-economy.onrender.com/agent/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentName, agentSecret, typedData }, (_, v) => typeof v === 'bigint' ? v.toString() : v)
        });
        const data = await response.json();
        return data.signature;
    };

    const crypto = await import('crypto');
    const dummyKey = "0x" + crypto.default.randomBytes(32).toString('hex');
    const gatewayClient = new GatewayClient({
        gatewayAddress: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
        privateKey: dummyKey,
        chain: "arcTestnet"
    });

    gatewayClient.account = { address, signTypedData: proxySign };
    gatewayClient.batchScheme.signer.address = address;

    console.log("\n[Phase 4] Executing gatewayClient.pay() for Crypto Insights...");
    try {
        const resp = await gatewayClient.pay("https://arc-agent-economy.onrender.com/api/crypto-insights?token=bitcoin", { method: "GET" });
        console.log("\n[Result] Service Data Acquired successfully!");
        console.log(resp.data);
    } catch (e) {
        console.error("Payment Failed:", e.message);
    }
}

runAgentSkill();
