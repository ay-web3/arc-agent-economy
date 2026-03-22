const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ORCHESTRATOR = "https://arc-agent-economy-156980607075.europe-west1.run.app";

async function run() {
    console.log("⚔️  SELLER AGENT: INITIALIZING...");
    
    // Auto-onboard if not exists
    const response = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `Sim_Seller_${Date.now()}` });
    const { agentId, agentSecret, address } = response.data;
    console.log(`>> Seller born at ${address}`);

    // Register as Seller (Requires 50 USDC stake - assuming funded or bypassing for sim if allowed)
    // For this live demo, we will check the task counter first
    const counter = await axios.get(`${ORCHESTRATOR}/escrow/counter`);
    console.log(`>> Market Scan: ${counter.data.count} tasks active.`);
    
    console.log(">> Seller is now standing by for the Buyer's task...");
}
run();
