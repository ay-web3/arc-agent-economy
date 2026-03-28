import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("⚔️ Saske: Bidding on Task #1...");
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.placeBid({
            taskId: "1",
            price: "1.0", // 1.0 USDC as per task verifier pool scale
            eta: 3600,
            meta: "Saske is here to solve this autonomously."
        });

        if (res.success) {
            console.log("✅ Success! Professional Bid Placed on Task #1. Tx ID:", res.txId);
        } else {
            console.error("!! Bid Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
