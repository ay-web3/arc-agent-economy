
import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

// DATA FROM PREVIOUS RUN
const buyer = { id: "Proof_Buyer_1776804064718", secret: "557a264a78950293da27ef56578a123a" }; // Example
const seller = { id: "Proof_Seller_1776804064718", secret: "..." };

// I will recover the IDs from the previous run's log if I can, or just use the ones I just printed.
// Wait! I'll just write a script that takes the IDs as input or hardcodes the ones I just saw.

async function finishProof(bId, bSec, sId, sSec, vId, vSec, taskId) {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - ENGINE A (ON-CHAIN) COMPLETION");
    console.log("================================================================");

    try {
        // 1. Bid
        console.log("\n[1/4] Seller Placing On-Chain Bid...");
        const bid = await axios.post(`${HUB_URL}/execute/placeBid`, {
            agentId: sId, agentSecret: sSec,
            taskId: taskId,
            price: "1.5",
            eta: 3600,
            meta: "0x0000000000000000000000000000000000000000000000000000000000000001"
        });
        console.log(`>> Bid Tx: ${bid.data.txId}`);

        // 2. Select
        console.log("\n[2/4] Buyer Selecting Bid...");
        const select = await axios.post(`${HUB_URL}/execute/selectBid`, {
            agentId: bId, agentSecret: bSec,
            taskId: taskId,
            bidIndex: 0
        });
        console.log(`>> Selection Tx: ${select.data.txId}`);

        // 3. Submit
        console.log("\n[3/4] Seller Submitting Work...");
        const submit = await axios.post(`${HUB_URL}/execute/submitResult`, {
            agentId: sId, agentSecret: sSec,
            taskId: taskId,
            hash: "0x0000000000000000000000000000000000000000000000000000000000000001",
            uri: "https://proof.arc/task/" + taskId
        });
        console.log(`>> Submission Tx: ${submit.data.txId}`);

        // 4. Approve (Payout Trigger)
        console.log("\n[4/4] Verifier Approving (Triggering On-Chain Payout)...");
        const approve = await axios.post(`${HUB_URL}/execute/approveTask`, {
            agentId: vId, agentSecret: vSec,
            taskId: taskId
        });
        console.log(`>> Approval Tx: ${approve.data.txId}`);

        console.log("\n💰 ESCROW SETTLED ON-CHAIN!");
        console.log(">> Check Seller's Balance on Explorer: https://explorer.testnet.arc.network/address/0x6c148c2e67b2fa84c9bc3e399b3a5a2460b8951e");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Error:", err.response?.data || err.message);
    }
}

// I'll extract the data from the previous turn's output
const bId = "Proof_Buyer_1776804064718"; // This was the timestamp from my code
// Wait! I'll just run a fresh full loop in ONE script to avoid ID mismatch.
