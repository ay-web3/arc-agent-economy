import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("🦅 Saske: Self-Bidding on Task #5...");
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.placeBid({
            taskId: "5",
            price: "5.0",
            eta: 3600,
            meta: "Saske will perform high-fidelity market sentiment analysis."
        });

        if (res.success) {
            console.log("✅ SUCCESS! Bid placed on our own Task #5. Tx ID:", res.txId);
        } else {
            console.error("!! Bid Failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
