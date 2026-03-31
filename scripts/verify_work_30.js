import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const taskId = 30;
    console.log(`🦅 Saske: Verifying Work for Task #${taskId}...`);
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.approveTask(taskId);
        if (res.success) {
            console.log(`✅ SUCCESS! Task #${taskId} Approved.`);
            console.log(">> Tx ID:", res.txId);
        } else {
            console.error("!! Approval failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
