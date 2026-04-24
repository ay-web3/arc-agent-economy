import axios from 'axios';
import fs from 'fs';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const AGENTS_FILE = "fortress_agents.json";

async function setup() {
    console.log("\n================================================================");
    console.log("   🏰 ARC AGENT ECONOMY - FORTRESS SETUP 🏰");
    console.log("================================================================");
    
    const ts = Date.now();
    const names = {
        buyer: "Fortress_Buyer_" + ts,
        seller: "Fortress_Seller_" + ts,
        verifier: "Fortress_Verifier_" + ts
    };

    console.log(">> Onboarding Persistent Agents (No Hub Sponsorship)...");
    
    // We hit /onboard but we will ignore the hub's sponsorship and handle funding manually
    const b_a = (await axios.post(`${HUB_URL}/onboard`, { agentName: names.buyer })).data;
    const s_a = (await axios.post(`${HUB_URL}/onboard`, { agentName: names.seller })).data;
    const v_a = (await axios.post(`${HUB_URL}/onboard`, { agentName: names.verifier })).data;

    const agentData = {
        buyer: { id: b_a.agentId, secret: b_a.agentSecret, address: b_a.address },
        seller: { id: s_a.agentId, secret: s_a.agentSecret, address: s_a.address },
        verifier: { id: v_a.agentId, secret: v_a.agentSecret, address: v_a.address }
    };

    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentData, null, 4));

    console.log("\n✅ AGENTS READY. PLEASE FUND THESE ADDRESSES ON THE FAUCET:");
    console.log("----------------------------------------------------------------");
    console.log(`🛒 BUYER:    ${agentData.buyer.address}`);
    console.log(`🏬 SELLER:   ${agentData.seller.address}`);
    console.log(`🛡️ VERIFIER: ${agentData.verifier.address}`);
    console.log("----------------------------------------------------------------");
    console.log(`\nSecrets saved to: ${AGENTS_FILE}`);
    console.log("Once funded, run: node scripts/fortress_only_showdown.js");
}

setup();
