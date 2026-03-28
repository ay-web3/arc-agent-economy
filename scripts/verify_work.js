import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("🦅 Saske: Verifying Work for Task #5...");
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.approveTask("5");

        if (res.success) {
            console.log("✅ SUCCESS! Task #5 approved as Verifier.");
            console.log(">> Status: QUORUM_APPROVED. Cooling-off (1 hour) started.");
        } else {
            console.error("!! Approval failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
