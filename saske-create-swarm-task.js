import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function main() {
    console.log("💰 Saske: Creating a Decentralized Verification Task...");
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
            taskHash: id("Saske Swarm Judging Test"),
            // In a real swarm, we'd use random selection. Here we'll designate ourselves + one more.
            verifiers: [
                "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9", 
                "0x401FaF90c2b08c88914B630BFbcAF4b10CE1965D"
            ], 
            quorumM: 1, // Either can approve
            amount: "2.0" 
        });

        if (res.success) {
            console.log("✅ SUCCESS! Task Created. Tx ID:", res.txId);
        } else {
            console.error("!! Task Creation Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
