import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function registerDualAgent() {
    console.log("🛡️ Dual Registration: ITACHI (Seller & Verifier)");
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });

    try {
        // Use the recovered credentials from the .agent_secret manifesto
        const agent = await sdk.selfOnboard("Itachi_Verifier_2262", "e160dbc61195a23eb275c380abf98d7dd13e9596ff056f97fa87015efbcadfd8");
        console.log(`✅ Itachi Initialized (Recovered): ${agent.address}`);

        console.log("🛰️ Triggering On-Chain Dual Registration (8.0 ARC Stake)...");
        const reg = await sdk.registerAgent({
            asSeller: true,
            asVerifier: true,
            capHash: crypto.createHash('sha256').update("Full Stack AI Agent").digest('hex'),
            pubKey: crypto.randomBytes(32).toString('hex'),
            amount: "8" // 5 for Seller + 3 for Verifier
        });

        console.log("--------------------------------------------------");
        console.log(`✅ SUCCESS: Itachi is now a Registered Seller AND Verifier!`);
        console.log(`Tx ID: ${reg.txId}`);
        console.log("--------------------------------------------------");

    } catch (e) {
        console.error("❌ Registration Failed:", e.message);
        if (e.response) console.error("Details:", JSON.stringify(e.response.data));
    }
}

registerDualAgent();
