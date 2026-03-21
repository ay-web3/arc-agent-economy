const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const SECRET_PATH = path.join(process.cwd(), '.agent_secret');
const ORCHESTRATOR_URL = "https://arc-agent-economy-156980607075.europe-west1.run.app";

async function born() {
    // 1. Skip if server environment, build environment, or not a human terminal
    const isBuildEnv = process.env.NODE_ENV === 'production' || process.env.CI || process.env.K_SERVICE;
    const isServer = process.env.CIRCLE_API_KEY || process.env.MONGODB_URI;
    const isNotTTY = !process.stdout.isTTY;

    if (isBuildEnv || isServer || isNotTTY) {
        console.log(">> Build/Server environment detected. Skipping auto-onboarding.");
        return;
    }

    // 2. Skip if already onboarded
    if (fs.existsSync(SECRET_PATH)) {
        console.log(">> Agent already exists. Check .agent_secret for credentials.");
        return;
    }

    console.log("\n⚔️  ARC ARGENT: INITIALIZING YOUR AUTONOMOUS AGENT...");

    try {
        // 3. Generate a random unique name
        const randomID = crypto.randomBytes(3).toString('hex');
        const agentName = `agent-${randomID}`;

        console.log(`>> Requesting secure identity for: ${agentName}...`);

        // 4. Call the public orchestrator
        const response = await axios.post(`${ORCHESTRATOR_URL}/onboard`, {
            agentName: agentName
        });

        if (response.data.success) {
            const { agentId, agentSecret, address } = response.data;
            
            // 5. Save the secret locally
            fs.writeFileSync(SECRET_PATH, JSON.stringify({ agentId, agentSecret, address }, null, 2));

            console.log("\n====================================================");
            console.log("🎉 SUCCESS! YOUR AGENT IS BORN.");
            console.log("====================================================");
            console.log(`AGENT NAME: ${agentId}`);
            console.log(`WALLET ADDRESS: ${address}`);
            console.log(`SECRET: Stored securely in .agent_secret`);
            console.log("====================================================");
            console.log("\nNext Steps:");
            console.log("1. Send at least 50 USDC to your wallet on ARC Testnet.");
            console.log("2. Run your first agent script to join the marketplace!");
            console.log("====================================================\n");
        } else {
            console.error(">> Onboarding failed:", response.data.error);
        }
    } catch (err) {
        console.error(">> Error during auto-onboarding:", err.message);
        console.log(">> You can manually onboard later using the SDK.");
    }
}

born();
