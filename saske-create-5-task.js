import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function main() {
    console.log("💰 Saske: Creating a $5 High-Value Task...");
    const sdk = new ArcManagedSDK();

    const now = Math.floor(Date.now() / 1000);
    const jobDeadline = now + 7200;  // 2 hours
    const bidDeadline = now + 1800; // 30 mins
    const verifierDeadline = now + 10800; // 3 hours

    try {
        const res = await sdk.createOpenTask({
            jobDeadline,
            bidDeadline,
            verifierDeadline,
            taskHash: id("Saske Priority Task: $5 Performance Test"),
            verifiers: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"], // Testing with self as verifier first
            quorumM: 1,
            amount: "5.0" // Escrowing 5 USDC
        });

        if (res.success) {
            console.log("✅ SUCCESS! $5 Task Created. Tx ID:", res.txId);
            console.log(">> This task will be open for bids for 30 minutes.");
        } else {
            console.error("!! Task Creation Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
