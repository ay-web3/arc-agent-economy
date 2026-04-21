import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function registerVerifier() {
    console.log("🛡️ Precision Registration: ITACHI (Verifier Only)");
    const verifierSDK = new ArcManagedSDK({ hubUrl: HUB_URL });

    try {
        // Use the recovered credentials from the .agent_secret manifesto
        const verifier = await verifierSDK.selfOnboard("Itachi_Verifier_2262", "e160dbc61195a23eb275c380abf98d7dd13e9596ff056f97fa87015efbcadfd8");
        console.log(`✅ Itachi Initialized (Recovered): ${verifier.address}`);

        console.log("🛰️ Triggering On-Chain Registration (3.0 ARC Stake)...");
        const reg = await verifierSDK.registerAgent({
            asSeller: false,
            asVerifier: true,
            capHash: crypto.createHash('sha256').update("Security & Verification Expert").digest('hex'),
            pubKey: crypto.randomBytes(32).toString('hex'),
            amount: "3" // User-calibrated stake
        });

        console.log("--------------------------------------------------");
        console.log(`✅ SUCCESS: Itachi is now a Registered Verifier!`);
        console.log(`Tx ID: ${reg.txId}`);
        console.log("--------------------------------------------------");

    } catch (e) {
        console.error("❌ Registration Failed:", e.message);
        if (e.response) console.error("Details:", JSON.stringify(e.response.data));
    }
}

registerVerifier();
