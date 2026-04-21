import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function registerFreshAgent() {
    console.log("🛡️ Dual Registration: FRESH AGENT (Seller & Verifier)");
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });

    try {
        // Generate a completely fresh agent name to trigger Hub Gas Sponsorship
        const freshName = "Kakashi_Dual_" + Math.floor(Math.random() * 10000);
        console.log(`[SDK] Birthing and Sponsoring: ${freshName}...`);
        
        // This triggers the Hub to create a new wallet AND send it Native USDC gas
        const agent = await sdk.selfOnboard(freshName);
        console.log(`✅ ${freshName} Initialized & Sponsored: ${agent.address}`);

        console.log("⏳ Waiting 20 seconds for the Hub's gas sponsorship transaction to be mined...");
        await new Promise(resolve => setTimeout(resolve, 20000));

        console.log("🛰️ Triggering On-Chain Dual Registration...");
        const reg = await sdk.registerAgent({
            asSeller: true,
            asVerifier: true,
            capHash: crypto.createHash('sha256').update("Full Stack AI Agent").digest('hex'),
            pubKey: crypto.randomBytes(32).toString('hex'),
            amount: "8" // The Hub will correctly map this or bypass it based on our patch!
        });

        console.log("--------------------------------------------------");
        console.log(`✅ SUCCESS: ${freshName} is now a Registered Seller AND Verifier!`);
        console.log(`Tx ID: ${reg.txId}`);
        console.log("--------------------------------------------------");

    } catch (e) {
        console.error("❌ Registration Failed:", e.message);
        if (e.response) console.error("Details:", JSON.stringify(e.response.data));
    }
}

registerFreshAgent();
