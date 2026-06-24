import axios from 'axios';

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fullLoop() {
    console.log("==========================================");
    console.log("🔄 FULL LOOP: Onboard → Fund → Deposit → Pay → Withdraw");
    console.log("==========================================\n");

    // ── Step 1: Onboard a fresh agent ──
    console.log(">> [1] Onboarding a fresh agent...");
    const AGENT_NAME = "loop_test_" + Date.now();
    const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: AGENT_NAME });
    const agent = onboardResp.data;
    console.log(`   ✅ Agent: ${AGENT_NAME}`);
    console.log(`   ✅ Address: ${agent.address}`);
    console.log(`   ✅ Secret: ${agent.agentSecret}`);
    console.log(`   ✅ Wallet ID: ${agent.walletId}`);

    // ── Step 2: Wait for auto-funding ──
    console.log("\n>> [2] Waiting for Hub auto-funding...");
    let funded = false;
    for (let i = 0; i < 30; i++) {
        await delay(5000);
        try {
            const bResp = await axios.get(`${HUB_URL}/debug/wallet/${agent.walletId}`);
            if (bResp.data?.balances) {
                const usdc = bResp.data.balances.find(b => b.token.symbol === "USDC" && b.token.isNative);
                if (usdc && parseFloat(usdc.amount) >= 0.005) {
                    console.log(`   ✅ Funded! Balance: ${usdc.amount} USDC`);
                    funded = true;
                    break;
                }
            }
        } catch (e) {}
        process.stdout.write(".");
    }
    if (!funded) {
        console.log("\n   ❌ Not funded in time. Aborting.");
        return;
    }

    // ── Step 3: Deposit into Gateway ──
    console.log("\n>> [3] Depositing 0.03 USDC into GatewayWallet...");
    console.log("   (approve + deposit, ~30-60 seconds)");
    try {
        const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
            agentName: AGENT_NAME,
            agentSecret: agent.agentSecret,
            amount: "0.03"
        }, { timeout: 180000 });
        console.log(`   ✅ Deposit Complete!`);
        console.log(`   Approve: ${depositResp.data.approveState}`);
        console.log(`   Deposit: ${depositResp.data.depositState}`);
    } catch (err) {
        console.error(`   ❌ Deposit Failed: ${err.response?.data?.error || err.message}`);
        console.log("   Aborting — can't withdraw without a deposit.");
        return;
    }

    await delay(5000);

    // ── Step 4: Check on-chain balance before withdrawal ──
    console.log("\n>> [4] Checking on-chain USDC balance BEFORE withdrawal...");
    try {
        const balResp = await axios.get(`${HUB_URL}/debug/wallet/${agent.walletId}`);
        const usdc = balResp.data?.balances?.find(b => b.token.symbol === "USDC" && b.token.isNative);
        console.log(`   USDC balance: ${usdc?.amount || 'unknown'}`);
    } catch (e) {
        console.log(`   Could not check: ${e.message}`);
    }

    // ── Step 5: Instant Cooperative Close Withdrawal ──
    const withdrawAmount = "0.01";
    console.log(`\n>> [5] Requesting Cooperative Close for ${withdrawAmount} USDC...`);
    try {
        const resp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, {
            agentName: AGENT_NAME,
            agentSecret: agent.agentSecret,
            amount: withdrawAmount
        }, { timeout: 60000 });
        console.log(`   ✅ SUCCESS!`);
        console.log(`   TX ID: ${resp.data.withdrawTxId}`);
        console.log(`   State: ${resp.data.state}`);

        // Wait for mining
        console.log("\n>> [6] Waiting for on-chain confirmation...");
        let finalState = resp.data.state;
        for (let i = 0; i < 20; i++) {
            await delay(3000);
            try {
                const statusResp = await axios.get(`${HUB_URL}/tx-status/${resp.data.withdrawTxId}`);
                finalState = statusResp.data.state;
                if (finalState === "COMPLETE") {
                    console.log(`   ✅ CONFIRMED ON-CHAIN!`);
                    console.log(`   TX Hash: ${statusResp.data.txHash}`);
                    break;
                } else if (finalState === "FAILED") {
                    console.log(`   ❌ TX FAILED on-chain: ${statusResp.data.errorReason}`);
                    break;
                }
            } catch (e) {}
            process.stdout.write(".");
        }

        // ── Step 7: Check balance AFTER withdrawal ──
        console.log("\n>> [7] Checking on-chain USDC balance AFTER withdrawal...");
        try {
            const balResp = await axios.get(`${HUB_URL}/debug/wallet/${agent.walletId}`);
            const usdc = balResp.data?.balances?.find(b => b.token.symbol === "USDC" && b.token.isNative);
            console.log(`   USDC balance: ${usdc?.amount || 'unknown'}`);
        } catch (e) {
            console.log(`   Could not check: ${e.message}`);
        }

    } catch (err) {
        console.error(`   ❌ Withdrawal Failed: ${err.response?.status} ${JSON.stringify(err.response?.data) || err.message}`);
    }

    console.log("\n==========================================");
    console.log("🏁 FULL LOOP COMPLETE");
    console.log("==========================================");
}

fullLoop();
