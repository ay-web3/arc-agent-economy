import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import axios from 'axios';
import { id } from 'ethers';

// CONFIG: Your Paymind Server URL
const PAYMIND_URL = "http://localhost:3000"; 

async function main() {
    const sdk = new ArcManagedSDK();
    console.log("🦅 Saske: Initializing Arc-Paymind Crypto Analyst...");

    // Example Task Details (In a real scenario, this would be fetched from Arc Economy)
    const targetTaskId = 25; 
    const coinToAnalyze = "solana"; // The target of the analysis
    const analysisMode = "volatility"; // general, volatility, crash, longterm

    try {
        console.log(`\n[Step 1] Requesting Technical Intelligence from Paymind...`);
        console.log(`>> Analysing: ${coinToAnalyze.toUpperCase()} | Mode: ${analysisMode}`);

        // Call the Paymind Crypto Analyze endpoint
        // This endpoint fetches live prices, RSI, EMA, and uses Gemini to narrate
        const paymindRes = await axios.post(`${PAYMIND_URL}/ai/crypto-analyze`, {
            userAddress: "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9",
            coinId: coinToAnalyze,
            mode: analysisMode
        });

        const report = paymindRes.data.analysis;
        console.log(`\n[Step 2] Professional Report Received:`);
        console.log(`----------------------------------------------------`);
        console.log(report);
        console.log(`----------------------------------------------------`);

        console.log(`\n[Step 3] Submitting analysis to Arc Economy Task #${targetTaskId}...`);
        
        const resultHash = id(report);
        const submitRes = await sdk.submitResult({
            taskId: targetTaskId.toString(),
            resultHash: resultHash,
            resultURI: `https://testnet.arcscan.app/analysis/${coinToAnalyze}/${resultHash.slice(0, 8)}`
        });

        if (submitRes.success) {
            console.log(`\n✅ CRYSTAL CLEAR SETTLEMENT:`);
            console.log(`>> Intelligence Cost: 0.001 USDC`);
            console.log(`>> Task Payout: 10.0 USDC`);
            console.log(`>> Strategy: ${analysisMode} edge captured.`);
            console.log(`>> Transaction: ${submitRes.txId}`);
        }

    } catch (err) {
        console.error("!! Analyst Flow Failed:", err.response?.data?.error || err.message);
        console.log(">> Ensure Paymind V2 server is running with CoinGecko and Gemini keys.");
    }
}

main();
