
import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function runNanoFlow() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - NANO ENGINE (OFF-CHAIN BATCHING)");
    console.log("================================================================");

    try {
        const ts = Date.now();
        console.log("\n[1/3] Onboarding Nano Agents...");
        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "NanoBuyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "NanoSeller_" + ts })).data;
        const v = (await axios.post(`${HUB_URL}/onboard`, { agentName: "NanoVerifier_" + ts })).data;
        console.log(`>> Buyer: ${b.address}\n>> Seller: ${s.address}\n>> Verifier: ${v.address}`);

        // Note: Nano is off-chain, so we don't even need to fuel them for the loop itself!
        // But for the final settlement to work, the Hub (Sentinel) must be funded.

        console.log("\n[2/3] Executing 3 Off-Chain Nano Tasks (Zero Gas)...");
        for(let i=1; i<=3; i++) {
            console.log(`\n--- Task #${i} ---`);
            
            // Create
            const createRes = await axios.post(`${HUB_URL}/nano/create`, {
                buyerAddress: b.address,
                amount: "1.0",
                manifestHash: "0x" + "n".repeat(64)
            });
            const taskId = createRes.data.taskId;
            console.log(`>> Created Off-chain Task ID: ${taskId}`);

            // Bid
            await axios.post(`${HUB_URL}/nano/bid`, {
                taskId, sellerAddress: s.address, bidPrice: "0.5"
            });
            console.log(">> Seller Bid Received.");

            // Select
            await axios.post(`${HUB_URL}/nano/select`, {
                taskId, bidIndex: 0
            });
            console.log(">> Buyer Selected Bid.");

            // Submit
            await axios.post(`${HUB_URL}/nano/submit`, {
                taskId, resultURI: "ipfs://nano-result-" + i
            });
            console.log(">> Seller Submitted Result.");

            // Approve (This triggers the batch tally)
            await axios.post(`${HUB_URL}/nano/approve`, {
                taskId, verifierAddress: v.address
            });
            console.log(">> Verifier Approved.");
        }

        console.log("\n[3/3] FINAL BATCH SETTLEMENT STATUS");
        console.log("✅ 3 Tasks completed off-chain.");
        console.log(">> The Hub has triggered the Circle x402 Gateway Settlement.");
        console.log(">> Check the Hub logs or Explorer for the Batch Settled event.");
        console.log(">> Gateway Address: 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Nano Flow Failed:", err.response?.data || err.message);
    }
}

runNanoFlow();
