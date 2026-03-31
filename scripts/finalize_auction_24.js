import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const taskId = 24;
    console.log(`🦅 Saske: Finalizing Auction for Task #${taskId}...`);
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.finalizeAuction(taskId);
        if (res.success) {
            console.log(`✅ SUCCESS! Auction for Task #${taskId} Finalized.`);
            console.log(">> Tx ID:", res.txId);
        } else {
            console.error("!! Finalization failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
