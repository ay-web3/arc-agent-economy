import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { id } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const SASKE_ADDR = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

const ESCROW_ABI = [
  { 'inputs': [], 'name': 'taskCounter', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' }
];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("\n🚀 INITIALIZING DISCOVERY DEMO: MULTI-AGENT SWARM CAPABILITIES");
    console.log("=========================================================================");

    try {
        const initialCounter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        
        // --- SCENARIO 1: DATA ANALYSIS JOB ---
        console.log(`\n📡 JOB 1: Creating 'Data Analysis' request...`);
        const analysisManifest = {
            type: "Analysis",
            topic: "Ethereum Gas Audit",
            requirements: ["Average Gwei (24h)", "Congestion Forecast"],
            format: "JSON"
        };
        const analysisHash = sdk.generateMetadataHash(analysisManifest);
        
        const createRes1 = await sdk.createOpenTask({
            jobDeadline: Math.floor(Date.now() / 1000) + 86400,
            bidDeadline: Math.floor(Date.now() / 1000) + 3600,
            verifierDeadline: Math.floor(Date.now() / 1000) + 90000,
            taskHash: analysisHash,
            verifiers: [SASKE_ADDR],
            quorumM: 1,
            amount: "5.0" 
        });
        console.log(`>> Analysis Job Posted. Manifest Hash: ${analysisHash.slice(0,10)}...`);

        // --- SCENARIO 2: CODE GENERATION JOB ---
        console.log(`\n📡 JOB 2: Creating 'Engineering' request...`);
        const codingManifest = {
            type: "Engineering",
            topic: "ERC-20 Smart Contract",
            requirements: ["OpenZeppelin base", "Mintable", "Burnable"],
            format: "Solidity Source"
        };
        const codingHash = sdk.generateMetadataHash(codingManifest);

        const createRes2 = await sdk.createOpenTask({
            jobDeadline: Math.floor(Date.now() / 1000) + 86400,
            bidDeadline: Math.floor(Date.now() / 1000) + 3600,
            verifierDeadline: Math.floor(Date.now() / 1000) + 90000,
            taskHash: codingHash,
            verifiers: [SASKE_ADDR],
            quorumM: 1,
            amount: "10.0" 
        });
        console.log(`>> Engineering Job Posted. Manifest Hash: ${codingHash.slice(0,10)}...`);

        // Wait for one to confirm
        let taskId;
        while (true) {
            taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
            if (taskId > initialCounter) break;
            process.stdout.write(".");
            await sleep(3000);
        }
        
        console.log(`\n\n✅ DISCOVERY READY:`);
        console.log(`>> Total Swarm Tasks: ${taskId}`);
        console.log(`>> Discovery Framework: Active`);
        console.log(`>> Outcome: Other agents can now 'pre-verify' these jobs by hashing their own capabilities.`);

    } catch (err) {
        console.error("\n❌ Demo Failed:", err.message);
    }
}

main();
