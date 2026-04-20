const axios = require('axios');
const { ethers } = require('ethers');

const ORCHESTRATOR = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function run() {
    console.log("⚔️  ARC ARGENT: FULL ECONOMY SIMULATION STARTING...");
    console.log("================================================");

    try {
        // 1. Born the Buyer
        console.log("\n[1/5] Birthing Buyer Agent...");
        const buyerRes = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `Sim_Buyer_${Date.now()}` });
        const buyer = buyerRes.data;
        console.log(`>> Buyer live at: ${buyer.address}`);

        // 2. Born the Seller
        console.log("\n[2/5] Birthing Seller Agent...");
        const sellerRes = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `Sim_Seller_${Date.now()}` });
        const seller = sellerRes.data;
        console.log(`>> Seller live at: ${seller.address}`);

        // Wait for on-chain indexing
        console.log("\n>> Waiting 10s for blockchain synchronization...");
        await new Promise(r => setTimeout(r, 10000));

        // 3. Register the Seller
        console.log("\n[3/5] Registering Seller (Simulation Mode)...");
        const regRes = await axios.post(`${ORCHESTRATOR}/execute/register`, {
            agentId: seller.agentId,
            agentSecret: seller.agentSecret,
            asSeller: true,
            asVerifier: false,
            capHash: ethers.id("coding-expertise"),
            pubKey: ethers.id("test-key"),
            stake: "0.001"
        });
        console.log(`>> Seller Registered! Tx: ${regRes.data.txId}`);

        // 4. Create the Task
        console.log("\n[4/5] Buyer Creating Task...");
        const now = Math.floor(Date.now() / 1000);
        const taskRes = await axios.post(`${ORCHESTRATOR}/execute/createOpenTask`, {
            agentId: buyer.agentId,
            agentSecret: buyer.agentSecret,
            jobDeadline: now + 3600,
            bidDeadline: now + 600,
            verifierDeadline: now + 1200,
            taskHash: ethers.id("First simulated task"),
            verifiers: [],
            quorumM: 0,
            amount: "0.001"
        });
        console.log(`>> Task Created! Tx: ${taskRes.data.txId}`);

        // 5. Seller Places Bid
        console.log("\n[5/5] Seller Scanning & Bidding...");
        const counter = await axios.get(`${ORCHESTRATOR}/escrow/counter`);
        const taskId = counter.data.count;
        
        const bidRes = await axios.post(`${ORCHESTRATOR}/execute/placeBid`, {
            agentId: seller.agentId,
            agentSecret: seller.agentSecret,
            taskId: taskId.toString(),
            price: "0.001"
        });
        console.log(`>> Bid Placed on Task #${taskId}! Tx: ${bidRes.data.txId}`);

        console.log("\n================================================");
        console.log("🏁 SIMULATION PHASE 1 COMPLETE.");
        console.log("Check the Ledger on your dashboard to see the live traffic.");
        console.log("================================================");

    } catch (err) {
        console.error("❌ Simulation Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

run();
