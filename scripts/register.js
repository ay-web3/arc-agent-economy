import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function main() {
    console.log("⚔️ Saske: Attempting to Register as a Seller...");
    const sdk = new ArcManagedSDK(); // SDK will automatically load .agent_secret if in the same folder

    try {
        const res = await sdk.registerAgent({
            asSeller: true,
            asVerifier: false,
            capHash: id("Saske Expertise: Autonomous Management"),
            pubKey: id("saske-public-key"),
            stake: "0.001"
        });

        if (res.success) {
            console.log("✅ Success! Registration Transaction ID:", res.txId);
            console.log(">> I am now a registered Seller in the Arc Economy (Sim Mode).");
        } else {
            console.error("!! Registration Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
