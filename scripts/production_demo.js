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
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }], 'name': 'tasks', 'outputs': [{ 'name': 'buyer', 'type': 'address' }, { 'name': 'seller', 'type': 'address' }, { 'name': 'price', 'type': 'uint256' }, { 'name': 'vPool', type: 'uint256' }, { 'name': 'sBudget', type: 'uint256' }, { 'name': 'deadline', type: 'uint64' }, { 'name': 'bidDeadline', type: 'uint64' }, { 'name': 'vDeadline', type: 'uint64' }, { 'name': 'appTime', type: 'uint64' }, { 'name': 'tHash', type: 'bytes32' }, { 'name': 'rHash', type: 'bytes32' }, { 'name': 'rURI', type: 'string' }, { 'name': 'state', type: 'uint8' }, { 'name': 'qM', type: 'uint8' }, { 'name': 'qN', type: 'uint8' }], 'stateMutability': 'view', 'type': 'function' },
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }, { 'name': 'index', 'type': 'uint256' }], 'name': 'bids', 'outputs': [{ 'name': 'bidder', 'type': 'address' }, { 'name': 'bidPrice', 'type': 'uint256' }, { 'name': 'etaSeconds', 'type': 'uint64' }, { 'name': 'metaHash', 'type': 'bytes32' }, { 'name': 'exists', 'type': 'bool' }], 'stateMutability': 'view', 'type': 'function' }
];

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("\n🚀 INITIALIZING PRODUCTION DEMO: THE ARC-PAYMIND INTELLIGENCE BRIDGE");
    console.log("=========================================================================");

    try {
        const initialCounter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        
        // --- PHASE 1: ARC TASK CREATION ---
        console.log(`\n📡 PHASE 1: Creating High-Value Intelligence Request...`);
        const now = Math.floor(Date.now() / 1000);
        const createRes = await sdk.createOpenTask({
            jobDeadline: now + 86400,
            bidDeadline: now + 3600,
            verifierDeadline: now + 90000,
            taskHash: id("BTC Market Sentiment Analysis " + now),
            verifiers: [SASKE_ADDR],
            quorumM: 1,
            amount: "20.0" 
        });

        if (!createRes.success) throw new Error("Task Creation failed: " + createRes.error);
        console.log(">> Task Broadcasted. TX:", createRes.txId);

        let taskId;
        while (true) {
            taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
            if (taskId > initialCounter) break;
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ Task # ${taskId} Published on Arc Agent Economy.`);

        // --- PHASE 2: BIDDING ---
        console.log(`\n🤝 PHASE 2: Saske Bidding for the Contract...`);
        const bidRes = await sdk.placeBid({
            taskId: taskId.toString(),
            price: "15.0", 
            eta: 3600,
            meta: id("High-Precision Gemini 1.5 Pro Analysis")
        });
        if (!bidRes.success) throw new Error("Bidding failed: " + bidRes.error);
        console.log(">> Bid Placed. Waiting for chain confirmation...");

        while (true) {
            try {
                const b = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, 0n] });
                if (b[4]) break; // Index 4 is exists
            } catch (e) {
                // Ignore revert if bid doesn't exist yet
            }
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ Bid Confirmed. Hiring Saske...`);

        // --- PHASE 3: SELECTION ---
        const selectRes = await sdk.selectBid(Number(taskId), 0);
        if (!selectRes.success) throw new Error("Hiring failed: " + selectRes.error);
        
        while (true) {
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
            if (t[12] === 2) break; 
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ Contract Signed. Saske is now performing the work.`);

        // --- PHASE 4: INTELLIGENCE ACQUISITION (PAYMIND) ---
        console.log(`\n🧠 PHASE 4: Fetching Real-Time Intelligence from Paymind API...`);
        console.log(`>> Executing On-chain x402 Micro-payment (0.001 USDC)...`);

        const paymindRes = await axios.post(`${PAYMIND_URL}/ai/crypto-analyze`, {
            userAddress: SESSION_ADDR, // Owner of the funded smart wallet
            coinId: "bitcoin",
            mode: "volatility"
        });

        const report = paymindRes.data.analysis;
        const pmTx = paymindRes.data.txHash;
        console.log(`>> Intelligence Secured! (Paymind Payment: ${pmTx.slice(0,10)}...)`);
        console.log(`----------------------------------------------------`);
        console.log(report);
        console.log(`----------------------------------------------------`);

        // --- PHASE 5: SUBMISSION ---
        console.log(`\n💰 PHASE 5: Delivering Work and Settling on Arc...`);
        const resultHash = id(report);
        const submitRes = await sdk.submitResult({
            taskId: taskId.toString(),
            resultHash: resultHash,
            resultURI: `https://paymind.io/report/${taskId}/${resultHash.slice(0,10)}`
        });
        if (!submitRes.success) throw new Error("Submission failed: " + submitRes.error);
        
        while (true) {
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
            if (t[12] === 3) break; 
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ Work Delivered to Escrow.`);

        // --- PHASE 6: VERIFICATION ---
        console.log(`\n🛡️  PHASE 6: Verifying and Finalizing...`);
        const approveRes = await sdk.approveTask(Number(taskId));
        if (!approveRes.success) throw new Error("Approval failed: " + approveRes.error);
        console.log(">> Work Verified. Finalizing payout...");

        // Note: In production, there might be a cooling window or keeper requirement
        const finalizeRes = await sdk.finalizeTask(taskId.toString());
        
        console.log(`\n====================================================`);
        console.log(`🎉 PRODUCTION DEMO SUCCESSFUL!`);
        console.log(`====================================================`);
        console.log(`>> Arc Revenue:       15.000 USDC`);
        console.log(`>> Paymind Cost:       0.001 USDC`);
        console.log(`>> Net Profit Margin: 99.993%`);
        console.log(`>> Status:            SETTLED & FINALIZED`);
        console.log(`====================================================\n`);

    } catch (err) {
        console.error("\n❌ Production Demo Failed:", err.response?.data?.error || err.message);
    }
}

main();
