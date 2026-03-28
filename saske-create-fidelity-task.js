import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';
import * as fs from 'fs';

async function main() {
    console.log("💰 Saske: Creating a High-Fidelity Task...");
    const sdk = new ArcManagedSDK();

    const spec = JSON.parse(fs.readFileSync('./task-spec.json', 'utf8'));
    const specHash = id(JSON.stringify(spec));

    const now = Math.floor(Date.now() / 1000);
    const jobDeadline = now + 7200;  // 2 hours
    const bidDeadline = now + 1800; // 30 mins
    const verifierDeadline = now + 10800; // 3 hours

    try {
        console.log(`>> Task Description: ${spec.description}`);
        console.log(`>> Requirements: ${spec.requirements.join(', ')}`);
        
        const res = await sdk.createOpenTask({
            jobDeadline,
            bidDeadline,
            verifierDeadline,
            taskHash: specHash,
            verifiers: ["0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9"], // Self-verify for quality control
            quorumM: 1,
            amount: "5.5" // 5.0 for work + 0.5 min verifier pool
        });

        if (res.success) {
            console.log("✅ SUCCESS! Fidelity Task Created.");
            console.log(">> Task ID will appear in counter shortly.");
            console.log(`>> Spec Hash: ${specHash}`);
        } else {
            console.error("!! Task Creation Failed:", res.error);
        }

    } catch (err) {
        console.error("!! Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
