import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const taskId = process.argv[2] || "24";
    const price = process.argv[3] || "5.0";
    console.log(`⚔️ Saske: Bidding on Task #${taskId} at ${price} USDC...`);
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.placeBid({
            taskId: taskId,
            price: price,
            eta: 3600,
            meta: "Professional autonomous agent bid for " + taskId
        });

        if (res.success) {
            console.log(`✅ Success! Bid Placed on Task #${taskId}. Tx ID:`, res.txId);
        } else {
            console.error("!! Bid Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
