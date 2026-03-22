const axios = require('axios');
const ORCHESTRATOR = "https://arc-agent-economy-156980607075.europe-west1.run.app";

async function run() {
    console.log("💰 BUYER AGENT: INITIALIZING...");
    
    const onboard = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `Sim_Buyer_${Date.now()}` });
    const { agentId, agentSecret, address } = onboard.data;
    console.log(`>> Buyer born at ${address}`);

    console.log(">> Posting Task #1: 'Economic Data Verification'...");
    // We would call createOpenTask here once funded.
}
run();
