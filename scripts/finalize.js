import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("⚡ Saske Keeper: Finalizing Task #3...");
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.finalizeTask("3");
        if (res.success) {
            console.log("✅ SUCCESS! Task #3 Finalized. Keeper fee earned.");
            console.log(">> Tx ID:", res.txId);
        } else {
            console.error("!! Finalization failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
