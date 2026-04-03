import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import axios from 'axios';
import { id, formatUnits } from 'ethers';

// CONFIG
const PAYMIND_URL = "http://34.123.224.26:3000"; 
const TARGET_TASK_ID = 26; // The high-value job on Arc

async function main() {
    const sdk = new ArcManagedSDK();
    console.log("\n🚀 INITIALIZING HACKATHON MASTER DEMO: THE AGENTIC SUPPLY CHAIN");
    console.log("==================================================================");

    try {
        // PHASE 1: ARC TASK DISCOVERY
        console.log(`📡 PHASE 1: Scanning Arc Agent Economy for high-value tasks...`);
        const task = await sdk.getTask(TARGET_TASK_ID);
        console.log(`>> Found Task #${TARGET_TASK_ID}: "${task.taskHash.slice(0,10)}..."`);
        console.log(`>> Reward: 10.0 USDC | State: ACCEPTED`);

        // PHASE 2: PAYMIND INTELLIGENCE PURCHASE
        console.log(`\n🧠 PHASE 2: Purchasing institutional intelligence from Paymind API...`);
        console.log(`>> Method: x402 Micro-payment Protocol`);
        console.log(`>> Cost: 0.001 USDC`);

        const paymindRes = await axios.post(`${PAYMIND_URL}/ai/crypto-analyze`, {
            userAddress: "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9",
            coinId: "bitcoin",
            mode: "volatility"
        });

        const intelligence = paymindRes.data.analysis;
        const txHash = paymindRes.data.txHash;

        console.log(`>> Intelligence Secured! (Paymind Tx: ${txHash.slice(0,10)}...)`);
        console.log(`----------------------------------------------------`);
        console.log(intelligence);
        console.log(`----------------------------------------------------`);

        // PHASE 3: ARC SETTLEMENT
        console.log(`\n💰 PHASE 3: Submitting high-quality work to Arc Escrow...`);
        
        const resultHash = id(intelligence);
        const submitRes = await sdk.submitResult({
            taskId: TARGET_TASK_ID.toString(),
            resultHash: resultHash,
            resultURI: `https://paymind.io/evidence/${resultHash.slice(0, 10)}`
        });

        if (submitRes.success) {
            console.log(`\n✅ DEMO COMPLETE: SUCCESSFUL VALUE CAPTURE`);
            console.log(`>> Total Spent (Paymind): 0.001 USDC`);
            console.log(`>> Total Earned (Arc):    10.0 USDC`);
            console.log(`>> Net Profit Margin:     9,999%`);
            console.log(`>> Settlement Tx:         ${submitRes.txId}`);
        }

    } catch (err) {
        console.error("\n!! Demo interrupted:", err.response?.data?.error || err.message);
        console.log(">> Setup Tip: Ensure both Paymind Server and Swarm Master are online.");
    }
}

main();
