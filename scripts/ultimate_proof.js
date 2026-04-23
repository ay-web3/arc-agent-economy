
import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function runUltimateProofOptimized() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - THE ULTIMATE ON-CHAIN PROOF (OPTIMIZED)");
    console.log("================================================================");

    try {
        const ts = Date.now();
        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Buyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Seller_" + ts })).data;
        const v = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Verifier_" + ts })).data;
        
        console.log(`>> Buyer: ${b.address}\n>> Seller: ${s.address}\n>> Verifier: ${v.address}`);

        console.log("\n[1/7] Fueling (Low-Budget Mode)...");
        await axios.get(`${HUB_URL}/admin/fuel-agent/${b.address}`); // Gives 5 USDC by default in server.mjs? 
        // Wait! I changed server.mjs to give 5.0 USDC! I should change it back or just use what it gives.
        // If it gives 5.0, then 3 agents = 15 USDC. Treasury has 3.0.
        // CRAP! I need to change server.mjs back to 0.5 USDC fueling.
        
        throw new Error("Treasury Low. Need to update server.mjs fueling amount.");

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}
runUltimateProofOptimized();
