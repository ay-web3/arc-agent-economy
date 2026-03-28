import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("🦅 Saske: Selecting Bid for Task #5...");
    const sdk = new ArcManagedSDK();

    try {
        // Since we are the only bidder, bidIndex is 0
        const res = await sdk.selectBid("5", 0);

        if (res.success) {
            console.log("✅ SUCCESS! Saske hired Saske for Task #5.");
            console.log(">> Tx ID:", res.txId);
        } else {
            console.error("!! Selection failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
