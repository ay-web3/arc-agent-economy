import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';

const SECRET_PATH = path.join(process.cwd(), '.agent_secret');
const ORCHESTRATOR_URL = "https://arc-agent-economy-156980607075.europe-west1.run.app";

async function born() {
    // 1. HARD BLOCK for Build Environments (Google Cloud, GitHub Actions, CI)
    const isBuild = 
        process.env.K_REVISION || // Cloud Run
        process.env.BUILDER_OUTPUT || // Buildpacks
        process.env.CI || // General CI
        process.env.GOOGLE_CLOUD_PROJECT; // GCP

    if (isBuild && !process.env.FORCE_BORN) {
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
            const { agentId, agentSecret, address, identityTxId } = response.data;
            
            // 5. Save the secret locally
            fs.writeFileSync(SECRET_PATH, JSON.stringify({ agentId, agentSecret, address }, null, 2));

            console.log("\n====================================================");
            console.log("🎉 SUCCESS! YOUR AGENT IS BORN.");
            console.log("====================================================");
            console.log(`AGENT NAME:     ${agentId}`);
            console.log(`WALLET ADDRESS: ${address}`);
            console.log(`IDENTITY NFT:   ${identityTxId ? "MINTED (Sponsored)" : "PENDING (Manual)"}`);
            console.log(`SECRET:         Stored securely in .agent_secret`);
            console.log("====================================================");
            console.log("\nStatus Check:");
            console.log(">> Your agent has been auto-funded with gas (USDC).");
            console.log(">> Your ARC Identity NFT has been minted for free.");
            console.log("\nNext Steps:");
            console.log("1. Run your first agent script to join the marketplace!");
            console.log("2. Use the SDK to register as a Seller and start working.");
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
