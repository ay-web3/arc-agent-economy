import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import { id } from 'ethers';
import fs from 'fs';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
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

    console.log("\n🛸 INITIALIZING MULTI-AGENT SWARM COMPETITION");
    console.log("=========================================================================");

    try {
        const initialCounter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
        
        // 1. Create a "Swarm Discovery" Task
        console.log(`\n📡 Step 1: Saske posting a new Discovery Job...`);
        const manifest = {
            type: "Intelligence",
            topic: "Swarm Behavior Audit",
            requirements: ["Multi-Agent Bidding Analysis", "Gas Efficiency Stats"],
            reward: "10.0 ARC"
        };
        const taskHash = sdk.generateMetadataHash(manifest);
        
        const createRes = await sdk.createOpenTask({
            jobDeadline: Math.floor(Date.now() / 1000) + 86400,
            bidDeadline: Math.floor(Date.now() / 1000) + 3600,
            verifierDeadline: Math.floor(Date.now() / 1000) + 90000,
            taskHash: taskHash,
            verifiers: [SASKE_ADDR],
            quorumM: 1,
            amount: "15.0" 
        });
        
        let taskId;
        while (true) {
            taskId = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
            if (taskId > initialCounter) break;
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ Task #${taskId} Live.`);

        // 2. Competitive Bidding
        console.log(`\n🤝 Step 2: Triggering Competitive Bidding...`);
        
        // Bid 1: Saske (The Original)
        console.log(`>> Saske placing bid (8.0 ARC)...`);
        await sdk.placeBid({
            taskId: taskId.toString(),
            price: "8.0",
            eta: 1800,
            meta: id("Saske Professional Audit")
        });

        // Bid 2: Challenger (The Rival)
        console.log(`>> Challenger Bot placing bid (7.5 ARC)...`);
        // We use the SDK again but it loads the session secret which is now registered
        const challengerRes = await sdk.placeBid({
            taskId: taskId.toString(),
            price: "7.5",
            eta: 1200,
            meta: id("Challenger High-Speed Audit")
        });

        // Wait for both bids to appear
        console.log(">> Waiting for bids to clear the blockchain...");
        while (true) {
            try {
                const b0 = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, 0n] });
                const b1 = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, 1n] });
                if (b0[4] && b1[4]) break;
            } catch (e) {}
            process.stdout.write(".");
            await sleep(3000);
        }
        console.log(`\n>> ✅ BATTLE DETECTED! Multiple agents are competing for Task #${taskId}.`);

        // 3. Selection (Hiring the cheaper agent)
        console.log(`\n💰 Step 3: Buyer selecting the most efficient agent (Challenger)...`);
        await sdk.selectBid(Number(taskId), 1);
        
        while (true) {
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
            if (t[12] === 2) { // Accepted
                console.log(`>> ✅ Contract AWARDED to Challenger Bot (${t[1]}).`);
                break;
            }
            process.stdout.write(".");
            await sleep(3000);
        }

        console.log(`\n====================================================`);
        console.log(`🎉 SWARM DEMO SUCCESSFUL!`);
        console.log(`====================================================`);
        console.log(`>> Discovery Framework: PROVEN`);
        console.log(`>> Multi-Agent Bidding: PROVEN`);
        console.log(`>> Competitive Market: ACTIVE`);
        console.log(`====================================================\n`);

    } catch (err) {
        console.error("\n❌ Swarm Demo Failed:", err.message);
    }
}

main();
