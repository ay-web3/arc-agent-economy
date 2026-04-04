import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const taskId = process.argv[2];
    if (!taskId) {
        console.error("Usage: node scripts/verify_work.js <taskId>");
        process.exit(1);
    }
    console.log(`🦅 Saske: Verifying Work for Task #${taskId}...`);
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.approveTask(taskId);

        if (res.success) {
            console.log(`✅ SUCCESS! Task #${taskId} approved as Verifier.`);
            console.log(">> Status: QUORUM_APPROVED. Cooling-off started.");
        } else {
            console.error("!! Approval failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
