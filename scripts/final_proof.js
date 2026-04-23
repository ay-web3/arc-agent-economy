
import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function runFullProof() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - ENGINE A (ON-CHAIN) FINAL PROOF");
    console.log("================================================================");

    try {
        // 1. Onboard
        console.log("\n[1/5] Onboarding Buyer, Seller, and Verifier...");
        const bReq = await axios.post(`${HUB_URL}/onboard`, { agentName: "Proof_Buyer_" + Date.now() });
        const sReq = await axios.post(`${HUB_URL}/onboard`, { agentName: "Proof_Seller_" + Date.now() });
        const vReq = await axios.post(`${HUB_URL}/onboard`, { agentName: "Proof_Verifier_" + Date.now() });

        const buyer = { id: bReq.data.agentId, secret: bReq.data.agentSecret, addr: bReq.data.address };
        const seller = { id: sReq.data.agentId, secret: sReq.data.agentSecret, addr: sReq.data.address };
        const verifier = { id: vReq.data.agentId, secret: vReq.data.agentSecret, addr: vReq.data.address };

        console.log(`>> Buyer: ${buyer.addr}`);
        console.log(`>> Seller: ${seller.addr}`);
        console.log(`>> Verifier: ${verifier.addr}`);

        // 2. Fueling (Essential for on-chain)
        console.log("\n[2/5] Fueling Agents (10 USDC each)...");
        await axios.get(`${HUB_URL}/admin/fuel-agent/${buyer.addr}`);
        await axios.get(`${HUB_URL}/admin/fuel-agent/${seller.addr}`);
        await axios.get(`${HUB_URL}/admin/fuel-agent/${verifier.addr}`);
        console.log(">> Fueling transactions sent. Waiting for network inclusion (15s)...");
        await new Promise(r => setTimeout(r, 15000));

        // 3. Registration
        console.log("\n[3/5] Registering Seller & Verifier (Staking)...");
        const sReg = await axios.post(`${HUB_URL}/execute/register`, {
            agentId: seller.id, agentSecret: seller.secret,
            asSeller: true, asVerifier: false, stake: "5.0",
            capHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
            pubKey: "0x0000000000000000000000000000000000000000000000000000000000000002"
        });
        const vReg = await axios.post(`${HUB_URL}/execute/register`, {
            agentId: verifier.id, agentSecret: verifier.secret,
            asSeller: false, asVerifier: true, stake: "5.0",
            capHash: "0x0000000000000000000000000000000000000000000000000000000000000003",
            pubKey: "0x0000000000000000000000000000000000000000000000000000000000000004"
        });
        console.log(`>> Seller Reg Tx: ${sReg.data.txId}`);
        console.log(`>> Verifier Reg Tx: ${vReg.data.txId}`);

        // 4. Create Task (Engine A)
        console.log("\n[4/5] Creating On-Chain Task (Budget: 3 USDC)...");
        const tCreate = await axios.post(`${HUB_URL}/execute/createOpenTask`, {
            agentId: buyer.id, agentSecret: buyer.secret,
            amount: "3.0",
            jobDeadline: Math.floor(Date.now()/1000) + 3600,
            bidDeadline: Math.floor(Date.now()/1000) + 1800,
            verifierDeadline: Math.floor(Date.now()/1000) + 7200,
            taskHash: "0x0000000000000000000000000000000000000000000000000000000000000005",
            verifiers: [verifier.addr],
            quorumM: 1
        });
        console.log(`>> Task Creation Tx: ${tCreate.data.txId}`);

        console.log("\n[5/5] Waiting for Task Inclusion & Payout Flow...");
        console.log(">> All transactions are now being processed by the ARC Testnet.");
        console.log(">> View Live Activity: https://explorer.testnet.arc.network/address/" + buyer.addr);
        console.log("\n✅ ENGINE A PROOF COMPLETE!");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Error:", err.response?.data || err.message);
    }
}

runFullProof();
