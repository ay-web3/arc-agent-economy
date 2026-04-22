import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import fs from 'fs';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const SECRET_PATH = ".agent_secret";

async function rebalance() {
    const verifierId = "LoopVerifier_9681";
    const sellerAddress = "0x98248a060b716f1e058315cf652df7e754e673e1";
    
    console.log(`🏦 Rebalancing Swarm: Sending 1.0 USDC from Verifier (${verifierId}) to Seller (${sellerAddress})...`);

    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });
    
    try {
        // 1. Recover Verifier Identity
        const verifier = await sdk.selfOnboard(verifierId);
        console.log(`✅ Verifier Identity Recovered: ${verifier.address}`);

        // 2. Trigger Transfer (Uses the new Hub endpoint I just proposed)
        console.log("🛰️ Initiating Transfer...");
        const res = await sdk.executeAndWait("transfer", {
            recipient: sellerAddress,
            amount: "1.0"
        });

        if (res.success) {
            console.log(`🎉 SUCCESS! 1.0 USDC sent to Seller.`);
            console.log(`Tx ID: ${res.txId}`);
        }
    } catch (e) {
        console.error("❌ Transfer Failed:", e.message);
        console.log("\n💡 Note: If the Hub returns 'Unknown action', I need to push the new Hub code first.");
    }
}

rebalance();
