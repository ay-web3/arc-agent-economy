
import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const RPC_URL = "https://rpc.testnet.arc.network";

async function runProof() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - ENGINE A (ON-CHAIN) PRODUCTION PROOF");
    console.log("================================================================");

    try {
        // 1. Setup Identities
        console.log("\n[1/6] Onboarding Production Agents...");
        const buyerRes = await axios.post(`${HUB_URL}/onboard`, { agentName: "Proof_Buyer_" + Date.now() });
        const sellerRes = await axios.post(`${HUB_URL}/onboard`, { agentName: "Proof_Seller_" + Date.now() });
        
        const buyer = { id: buyerRes.data.agentId, addr: buyerRes.data.address };
        const seller = { id: sellerRes.data.agentId, addr: sellerRes.data.address };
        
        console.log(`>> Buyer: ${buyer.addr}`);
        console.log(`>> Seller: ${seller.addr}`);

        // 2. Fueling (Using Hub Treasury)
        console.log("\n[2/6] Fueling Agents with Test USDC from Treasury...");
        await axios.get(`${HUB_URL}/admin/fuel-agent/${buyer.addr}`);
        await axios.get(`${HUB_URL}/admin/fuel-agent/${seller.addr}`);
        console.log(">> Fueling transactions initiated. Waiting for network inclusion...");
        await new Promise(r => setTimeout(r, 10000)); // Wait for tokens to arrive

        // 3. Seller Registration
        console.log("\n[3/6] Registering Seller in AgentRegistry (On-Chain Stake)...");
        const regRes = await axios.post(`${HUB_URL}/execute`, {
            agentId: seller.id,
            action: "register",
            params: {
                asSeller: true,
                asVerifier: false,
                capHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
                pubKey: "0x0000000000000000000000000000000000000000000000000000000000000002",
                stake: "5.0"
            }
        });
        console.log(`>> Registration Tx ID: ${regRes.data.txId}`);

        // 4. Create Task (Engine A - Standard)
        console.log("\n[4/6] Buyer Creating On-Chain Task (Engine A)...");
        const taskRes = await axios.post(`${HUB_URL}/execute`, {
            agentId: buyer.id,
            action: "createOpenTask",
            params: {
                jobDeadline: Math.floor(Date.now()/1000) + 3600,
                bidDeadline: Math.floor(Date.now()/1000) + 1800,
                verifierDeadline: Math.floor(Date.now()/1000) + 7200,
                taskHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
                verifiers: [],
                quorumM: 0,
                isNano: false,
                amount: "2.0" // Budget
            }
        });
        console.log(`>> Task Creation Tx ID: ${taskRes.data.txId}`);

        console.log("\n[SYSTEM] Deployment Successful. Check ARC Explorer for these Transaction IDs.");
        console.log(">> Explorer: https://explorer.testnet.arc.network");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Proof Failed:", err.response?.data || err.message);
    }
}

runProof();
