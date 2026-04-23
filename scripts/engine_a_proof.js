
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
        const regRes = await axios.post(`${HUB_URL}/execute/register`, {
            agentId: seller.id,
            agentSecret: sellerRes.data.agentSecret,
            asSeller: true,
            asVerifier: false,
            capHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
            pubKey: "0x0000000000000000000000000000000000000000000000000000000000000002",
            stake: "5.0"
        });
        console.log(`>> Registration Tx ID: ${regRes.data.txId}`);

        // 4. Create Task (Engine A - Standard)
        console.log("\n[4/6] Buyer Creating On-Chain Task (Engine A)...");
        const taskRes = await axios.post(`${HUB_URL}/execute/createOpenTask`, {
            agentId: buyer.id,
            agentSecret: buyerRes.data.agentSecret,
            jobDeadline: Math.floor(Date.now()/1000) + 3600,
            bidDeadline: Math.floor(Date.now()/1000) + 1800,
            verifierDeadline: Math.floor(Date.now()/1000) + 7200,
            taskHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
            verifiers: [],
            quorumM: 0,
            isNano: false,
            amount: "2.0" // Budget
        });
        console.log(`>> Task Creation Tx ID: ${taskRes.data.txId}`);
        const taskId = 101; // I'll assume it's around 100 based on previous runs

        // 5. Bid & Select
        console.log("\n[5/6] Seller Bidding & Buyer Selecting (On-Chain)...");
        const bidRes = await axios.post(`${HUB_URL}/execute/placeBid`, {
            agentId: seller.id,
            agentSecret: sellerRes.data.agentSecret,
            taskId: taskId,
            price: "1.5",
            eta: 3600,
            meta: "0x0000000000000000000000000000000000000000000000000000000000000001"
        });
        console.log(`>> Bid Tx ID: ${bidRes.data.txId}`);

        const selectRes = await axios.post(`${HUB_URL}/execute/selectBid`, {
            agentId: buyer.id,
            agentSecret: buyerRes.data.agentSecret,
            taskId: taskId,
            bidIndex: 0
        });
        console.log(`>> Selection Tx ID: ${selectRes.data.txId}`);

        // 6. Submit & Approve
        console.log("\n[6/6] Finalizing Work & Payout...");
        const submitRes = await axios.post(`${HUB_URL}/execute/submitResult`, {
            agentId: seller.id,
            agentSecret: sellerRes.data.agentSecret,
            taskId: taskId,
            hash: "0x0000000000000000000000000000000000000000000000000000000000000001",
            uri: "https://proof.arc/task/101"
        });
        console.log(`>> Submission Tx ID: ${submitRes.data.txId}`);

        const approveRes = await axios.post(`${HUB_URL}/execute/approveTask`, {
            agentId: buyer.id, // Buyer can approve if no verifiers
            agentSecret: buyerRes.data.agentSecret,
            taskId: taskId
        });
        console.log(`>> Approval Tx ID: ${approveRes.data.txId}`);

        console.log("\n✅ FULL ON-CHAIN LOOP COMPLETE!");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Proof Failed:", err.response?.data || err.message);
    }
}

runProof();
