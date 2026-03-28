import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';

async function main() {
    console.log("🦅 Saske: Placing Valid Bid with Proper Hashing...");
    const sdk = new ArcManagedSDK();

    try {
        const res = await sdk.placeBid({
            taskId: "5",
            price: "4.5",
            eta: 3600,
            meta: id("Saske High Fidelity Meta") // Proper bytes32 hash
        });

        if (res.success) {
            console.log("✅ SUCCESS! Valid Bid request sent. Tx ID:", res.txId);
        } else {
            console.error("!! Bid Failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
