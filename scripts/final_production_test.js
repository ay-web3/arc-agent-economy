import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function runTest() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - FINAL PRODUCTION TEST");
    console.log("================================================================");

    try {
        const ts = Date.now();
        
        // 1. Onboard Agents
        console.log("\n[1/5] Onboarding Agents...");
        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "TestBuyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "TestSeller_" + ts })).data;
        console.log(`>> Buyer: ${b.address}`);
        console.log(`>> Seller: ${s.address}`);

        // 2. Fuel Agents (Using existing Treasury funds)
        console.log("\n[2/5] Fueling Agents (0.1 USDC each)...");
        await axios.get(`${HUB_URL}/admin/fuel-agent/${b.address}?amount=0.1`);
        await axios.get(`${HUB_URL}/admin/fuel-agent/${s.address}?amount=0.1`);
        console.log(">> Fueling successful.");

        // 3. Register Seller (Engine A requirement)
        console.log("\n[3/5] Registering Seller (0.1 USDC Stake)...");
        const reg = await axios.post(`${HUB_URL}/execute/register`, {
            agentId: s.agentId,
            agentSecret: s.agentSecret,
            asSeller: true,
            asVerifier: true,
            stake: "0.1"
        });
        console.log(`>> Registration Tx: ${reg.data.txId}`);

        // 4. Engine B Test (Nano/x402)
        console.log("\n[4/5] Testing Engine B (Nano-Payments)...");
        console.log(`>> Depositing 0.1 USDC into Nano Ledger...`);
        await axios.post(`${HUB_URL}/execute/deposit-nano`, {
            agentId: b.agentId,
            agentSecret: b.agentSecret,
            amount: "0.1"
        });
        
        const taskId = (await axios.post(`${HUB_URL}/nano/create`, { buyerAddress: b.address, amount: "0.01" })).data.taskId;
        await axios.post(`${HUB_URL}/nano/bid`, { taskId, sellerAddress: s.address, bidPrice: "0.01" });
        await axios.post(`${HUB_URL}/nano/select`, { taskId, bidIndex: 0 });
        await axios.post(`${HUB_URL}/nano/submit`, { taskId, resultURI: "ipfs://test-work" });
        await axios.post(`${HUB_URL}/nano/approve`, { taskId, verifierAddress: s.address }); // Self-verify for demo
        console.log(">> Engine B Flow Successful.");

        // 5. Engine A Test (Standard Escrow)
        console.log("\n[5/5] Testing Engine A (On-Chain Task)...");
        const ethTime = Math.floor(Date.now()/1000);
        const task = await axios.post(`${HUB_URL}/execute/createOpenTask`, {
            agentId: b.agentId,
            agentSecret: b.agentSecret,
            jobDeadline: ethTime + 3600,
            bidDeadline: ethTime + 1800,
            verifierDeadline: ethTime + 7200,
            taskHash: "0x" + "a".repeat(64),
            verifiers: [s.address],
            quorumM: 1,
            amount: "0.1"
        });
        console.log(`>> Engine A Task Created. Tx: ${task.data.txId}`);

        console.log("\n✅ ALL ENGINES OPERATIONAL!");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Test Failed:", err.response?.data || err.message);
    }
}

runTest();
