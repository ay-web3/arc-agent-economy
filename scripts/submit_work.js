import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';
import * as fs from 'fs';

async function main() {
    console.log("🦅 Saske: Submitting Work for Task #5...");
    const sdk = new ArcManagedSDK();

    const reportContent = fs.readFileSync('./sentiment-report.md', 'utf8');
    const resultHash = id(reportContent);
    const resultURI = "https://gist.github.com/saske/sentiment-report-demo"; // Placeholder for production URI

    try {
        const res = await sdk.submitResult({
            taskId: "5",
            resultHash: resultHash,
            resultURI: resultURI
        });

        if (res.success) {
            console.log("✅ SUCCESS! Work submitted for Task #5.");
            console.log(">> Result Hash:", resultHash);
            console.log(">> Next: Verification.");
        } else {
            console.error("!! Submission failed:", res.error);
        }
    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
