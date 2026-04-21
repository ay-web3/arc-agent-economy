import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function diagnoseHubSponsorship() {
    console.log("🔍 Diagnosing Hub Gas Sponsorship...");
    try {
        const freshName = "TestAgent_" + Math.floor(Math.random() * 100000);
        console.log(`Sending /onboard request for ${freshName}...`);
        
        const res = await axios.post(`${HUB_URL}/onboard`, { agentName: freshName });
        
        console.log("\n--- HUB ONBOARDING RESPONSE ---");
        console.log(JSON.stringify(res.data, null, 2));
        console.log("-------------------------------");
        
        if (res.data.hubError) {
            console.log("\n🚨 The Hub is failing to sponsor gas! Error details:");
            console.log(res.data.hubError);
        } else {
            console.log("\n✅ The Hub successfully sponsored the agent! (Or skipped it if MASTER_WALLET_ID is not set)");
        }
    } catch (e) {
        console.error("Failed to reach Hub:", e.message);
    }
}

diagnoseHubSponsorship();
