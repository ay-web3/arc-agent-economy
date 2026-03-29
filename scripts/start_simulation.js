import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id, parseUnits } from 'ethers';

async function main() {
    const sdk = new ArcManagedSDK();
    console.log("🦅 Saske: Initializing Simulation - Creating a High-Value Macro-Task...");

    try {
        // We create a task as a Buyer (Ayo) to be solved by the Supply Chain
        const jobDeadline = Math.floor(Date.now() / 1000) + 86400; // 24h
        const bidDeadline = Math.floor(Date.now() / 1000) + 3600;  // 1h
        const verifierDeadline = jobDeadline + 3600;

        const res = await sdk.createOpenTask({
            jobDeadline,
            bidDeadline,
            verifierDeadline,
            taskHash: id("Analyze BTC Volatility for Hackathon Demo"),
            verifiers: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"], // Saske as verifier for demo
            quorumM: 1,
            value: "10.0" // 10 USDC Reward
        });

        if (res.success) {
            console.log("\n====================================================");
            console.log("🚀 SIMULATION STARTED: TASK CREATED ON ARC");
            console.log("====================================================");
            console.log(`TASK ID: ${res.taskId}`);
            console.log(`REWARD:  10.0 USDC`);
            console.log(`STATUS:  Auction Live - Awaiting Bids`);
            console.log("====================================================\n");
            console.log("Next step: Run 'npm run demo' to have the agent fulfill this task using Paymind!");
        } else {
            console.error("!! Simulation failed to start:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
