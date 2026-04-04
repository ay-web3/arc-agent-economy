import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import axios from 'axios';
import { id, formatUnits } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const PAYMIND_URL = "http://34.123.224.26:3000";
const SASKE_ADDR = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
const SESSION_ADDR = "0x3C49ed28E2918B0414140eD820D4A885B0b0FD3A";

const ESCROW_ABI = [
  { 'inputs': [], 'name': 'taskCounter', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'stateMutability': 'view', 'type': 'function' },
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }], 'name': 'tasks', 'outputs': [{ 'name': 'buyer', 'type': 'address' }, { 'name': 'seller', 'type': 'address' }, { 'name': 'price', 'type': 'uint256' }, { 'name': 'vPool', type: 'uint256' }, { 'name': 'sBudget', type: 'uint256' }, { 'name': 'deadline', type: 'uint64' }, { 'name': 'bidDeadline', type: 'uint64' }, { 'name': 'vDeadline', type: 'uint64' }, { 'name': 'appTime', type: 'uint64' }, { 'name': 'tHash', type: 'bytes32' }, { 'name': 'rHash', type: 'bytes32' }, { 'name': 'rURI', type: 'string' }, { 'name': 'state', type: 'uint8' }, { 'name': 'qM', type: 'uint8' }, { 'name': 'qN', type: 'uint8' }], 'stateMutability': 'view', 'type': 'function' }
];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("\n🚀 INITIALIZING TRANSPARENT DEMO: THE AGENTIC DISCOVERY PROTOCOL");
    console.log("=========================================================================");

    try {
        const initialCounter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        
        // --- PHASE 1: TRANSPARENT TASK CREATION ---
        console.log(`\n📡 PHASE 1: Creating Job with Public Metadata...`);
        
        const taskMetadata = {
            title: "Bitcoin Volatility Sentiment Audit",
            description: "Requesting a combined RSI/EMA analysis for BTC/USD on the 1H timeframe.",
            requirements: ["Gemini 1.5 Flash Narrated", "On-chain evidence"],
            reward: "15.0 USDC"
        };
        
        // We use the new generateMetadataHash for deterministic discovery
        const taskHash = sdk.generateMetadataHash(taskMetadata);
        console.log(`>> Job Manifest Generated. Hash: ${taskHash.slice(0, 10)}...`);

        const now = Math.floor(Date.now() / 1000);
        const createRes = await sdk.createOpenTask({
            jobDeadline: now + 86400,
            bidDeadline: now + 3600,
            verifierDeadline: now + 90000,
            taskHash: taskHash, // This is now a searchable manifest hash
            verifiers: [SASKE_ADDR],
            quorumM: 1,
            amount: "20.0" 
        });

        if (!createRes.success) throw new Error("Task Creation failed: " + createRes.error);
        
        let taskId;
        while (true) {
            taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
            if (taskId > initialCounter) break;
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ Task # ${taskId} Published.`);

        // --- PHASE 2: INTELLIGENCE ACQUISITION ---
        console.log(`\n🧠 PHASE 2: Securing Intelligence via x402 Bridge...`);
        const paymindRes = await axios.post(`${PAYMIND_URL}/ai/crypto-analyze`, {
            userAddress: SESSION_ADDR,
            coinId: "bitcoin",
            mode: "general"
        });

        const report = paymindRes.data.analysis;
        console.log(`\n[Intelligence Secured]`);
        console.log(`----------------------------------------------------`);
        console.log(report);
        console.log(`----------------------------------------------------`);

        // --- PHASE 3: TRANSPARENT SUBMISSION ---
        console.log(`\n💰 PHASE 3: Delivering Work with Public Result URI...`);
        
        const resultHash = id(report);
        const resultURI = `https://paymind.io/report/${taskId}/${resultHash.slice(2, 12)}`;
        
        console.log(`>> Result Hash: ${resultHash}`);
        console.log(`>> Evidence URI: ${resultURI}`);

        const submitRes = await sdk.submitResult({
            taskId: taskId.toString(),
            resultHash: resultHash,
            resultURI: resultURI // This link is clickable on ArcScan for judges/agents
        });

        if (submitRes.success) {
            console.log(`\n✅ TRANSPARENT FLOW COMPLETE:`);
            console.log(`>> All agents can now see the "Evidence" link on-chain.`);
            console.log(`>> Payout: 15.0 USDC captured.`);
        }

    } catch (err) {
        console.error("\n❌ Demo Failed:", err.response?.data?.error || err.message);
    }
}

main();
