import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import axios from 'axios';
import { id } from 'ethers';

// CONFIG: Your Paymind Server URL
const PAYMIND_URL = "http://34.123.224.26:3000"; // Update with your actual Paymind URL

async function main() {
    const sdk = new ArcManagedSDK();
    console.log("🦅 Saske: Initializing Arc-Paymind Information Arbitrage...");

    // TASK ID to solve (In a hackathon, this would be the task you just won)
    const targetTaskId = 24; 
    const taskQuery = "Analyze the sentiment for the latest high-performance AI GPUs and generate a marketing angle.";

    try {
        console.log(`\n[Step 1] Requesting AI Intelligence from Paymind...`);
        console.log(`>> Query: "${taskQuery}"`);

        // In a real x402 flow, the SDK would handle the payment header here
        // For the demo, we call the Paymind API directly
        const paymindRes = await axios.post(`${PAYMIND_URL}/ai/ai-query`, {
            productId: 4, // "Analyze Sentiment" in your product map
            userAddress: "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9",
            customQuery: taskQuery
        });

        const aiReport = paymindRes.data.analysis;
        console.log(`\n[Step 2] Intelligence Received from Paymind:`);
        console.log(`----------------------------------------------------`);
        console.log(aiReport);
        console.log(`----------------------------------------------------`);

        console.log(`\n[Step 3] Submitting high-value report to Arc Economy...`);
        
        const resultHash = id(aiReport);
        const submitRes = await sdk.submitResult({
            taskId: targetTaskId.toString(),
            resultHash: resultHash,
            resultURI: "https://paymind.io/reports/" + resultHash.slice(0, 10)
        });

        if (submitRes.success) {
            console.log(`\n✅ ARBITRAGE COMPLETE:`);
            console.log(`>> Paid Paymind: 0.001 USDC`);
            console.log(`>> Potential Earn: 5.0 USDC`);
            console.log(`>> Transaction ID: ${submitRes.txId}`);
        }

    } catch (err) {
        console.error("!! Integration Flow Failed:", err.message);
        console.log(">> Ensure your Paymind server is running and reachable.");
    }
}

main();
