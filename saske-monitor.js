import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("⚔️ Saske: Continuous Monitoring Service...");
    const sdk = new ArcManagedSDK();

    setInterval(async () => {
        try {
            const count = await sdk.getTaskCounter();
            console.log(`[${new Date().toLocaleTimeString()}] Global Task Count: ${count}`);
            
            if (count > 3) {
                console.log("🚀 NEW TASK DETECTED! Auditing...");
                // In a real scenario, we'd trigger the full audit here
            }
        } catch (e) {
            console.error("!! Monitor Error:", e.message);
        }
    }, 30000); // Check every 30s
}

main();
