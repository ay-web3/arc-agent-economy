import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function main() {
    console.log("💰 Saske: Creating our own Task (Demo/Verification)...");
    const sdk = new ArcManagedSDK({ secretPath: './arc-agent-economy/.agent_secret' });

    const now = Math.floor(Date.now() / 1000);
    const jobDeadline = now + 3600; // 1 hour
    const bidDeadline = now + 600;  // 10 mins
    const verifierDeadline = now + 7200; // 2 hours

    try {
        const res = await sdk.createOpenTask({
            jobDeadline,
            bidDeadline,
            verifierDeadline,
            taskHash: id("Saske Autonomous Task: System Verification"),
            verifiers: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"], // Using self as verifier for demo
            quorumM: 1,
            amount: "1.0" // Escrowing 1 USDC
        });

        if (res.success) {
            console.log("✅ SUCCESS! Task Created. Tx ID:", res.txId);
            console.log(">> New Task ID will show in getTaskCounter soon.");
        } else {
            console.error("!! Task Creation Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
