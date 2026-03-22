const axios = require('axios');
const { ethers } = require('ethers');

const ORCHESTRATOR = "https://arc-agent-economy-156980607075.europe-west1.run.app";
const PREFIX = "Sim_Internal_Ayo_";

async function run() {
    console.log("⚔️  ARC ARGENT: INTERNAL SYSTEM SIMULATION STARTING...");
    console.log("================================================");

    try {
        const id = Date.now();
        
        // 1. Born the Buyer
        console.log("\n[1/5] Birthing Internal Buyer Agent...");
        const buyerRes = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `${PREFIX}Buyer_${id}` });
        const buyer = buyerRes.data;
        console.log(`>> Buyer live at: ${buyer.address}`);

        // 2. Born the Seller
        console.log("\n[2/5] Birthing Internal Seller Agent...");
        const sellerRes = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `${PREFIX}Seller_${id}` });
        const seller = sellerRes.data;
        console.log(`>> Seller live at: ${seller.address}`);

        // Wait for on-chain indexing and internal funding (1 USDC each)
        console.log("\n>> Waiting 25s for internal funding (1.0 USDC) and blockchain sync...");
        await new Promise(r => setTimeout(r, 25000));

        // 3. Register the Seller
        console.log("\n[3/5] Registering Seller (Lowered Min: 0.01 USDC)...");
        const regRes = await axios.post(`${ORCHESTRATOR}/execute/register`, {
            agentId: seller.agentId,
            agentSecret: seller.agentSecret,
            asSeller: true,
            asVerifier: false,
            capHash: ethers.id("coding-expertise"),
            pubKey: ethers.id("test-key"),
            stake: "0.1"
        });
        console.log(`>> Seller Registered! Tx: ${regRes.data.txId}`);

        // 4. Create the Task
        console.log("\n[4/5] Buyer Creating Task (Simulation Micro-Amount: 1.1 USDC)...");
        const now = Math.floor(Date.now() / 1000);
        const taskRes = await axios.post(`${ORCHESTRATOR}/execute/createOpenTask`, {
            agentId: buyer.agentId,
            agentSecret: buyer.agentSecret,
            jobDeadline: now + 3600,
            bidDeadline: now + 600,
            verifierDeadline: now + 1200,
            taskHash: ethers.id(`Autonomous Task ${id}`),
            verifiers: ["0x401FaF90c2b08c88914B630BFbcAF4b10CE1965D"], 
            quorumM: 1,
            amount: "1.1"
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
            price: "1.0"
        });
        console.log(`>> Bid Placed on Task #${taskId}! Tx: ${bidRes.data.txId}`);

        console.log("\n================================================");
        console.log("🏁 INTERNAL SIMULATION SUCCESS.");
        console.log(`Dashboard Ledger should show activity for Task #${taskId}`);
        console.log("================================================");

    } catch (err) {
        console.error("❌ Simulation Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

run();
