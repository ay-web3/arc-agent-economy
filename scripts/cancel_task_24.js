import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const taskId = 24;
    console.log(`🦅 Saske: Canceling Task #${taskId} (No Bids)...`);
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.cancelIfNoBids(taskId);
        if (res.success) {
            console.log(`✅ SUCCESS! Task #${taskId} Canceled.`);
            console.log(">> Tx ID:", res.txId);
        } else {
            console.error("!! Cancellation failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
