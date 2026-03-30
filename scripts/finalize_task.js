import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const taskId = process.argv[2];
    if (!taskId) {
        console.error("Usage: node scripts/finalize_task.js <taskId>");
        process.exit(1);
    }

    console.log(`⚡ Saske Keeper: Finalizing Task #${taskId}...`);
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.finalizeTask(taskId);
        if (res.success) {
            console.log(`✅ SUCCESS! Task #${taskId} Finalized. Keeper fee earned.`);
            console.log(">> Tx ID:", res.txId);
        } else {
            console.error("!! Finalization failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
