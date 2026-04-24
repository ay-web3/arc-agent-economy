import axios from 'axios';
import fs from 'fs';
import { createPublicClient, http, parseAbi } from 'viem';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW_ADDR = "0xdf5455170bce05d961c8643180f22361c0340de0"; 
const EXPLORER_BASE = "https://explorer.testnet.arc.network/tx/";
const AGENTS_FILE = "fortress_agents.json";

const pc = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});
const abi = parseAbi(['function taskCounter() view returns (uint256)']);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runFortress() {
    console.log("\n================================================================");
    console.log("   🏰 ARC AGENT ECONOMY - FORTRESS PERSISTENT DEMO 🏰");
    console.log("================================================================");

    if (!fs.existsSync(AGENTS_FILE)) {
        console.error(`!! Error: ${AGENTS_FILE} not found. Run 'node setup_fortress_agents.js' first.`);
        return;
    }

    const agents = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    const { buyer, seller, verifier } = agents;

    console.log(`>> Resuming Fortress Agents:`);
    console.log(`   Buyer:    ${buyer.address}`);
    console.log(`   Seller:   ${seller.address}`);
    console.log(`   Verifier: ${verifier.address}`);

    // Skip fueling - assume user funded them

    /*
    console.log("\n>> Registering & Staking (1.0 USDC each)...");
    const r1 = await axios.post(`${HUB_URL}/execute/register`, { 
        agentId: seller.id, agentSecret: seller.secret, 
        asSeller: true, asVerifier: false, stake: "1.0", capHash: "0x11", pubKey: "0x22" 
    });
    console.log(`   Seller Registered: ${EXPLORER_BASE}${r1.data.txId}`);
    
    const r2 = await axios.post(`${HUB_URL}/execute/register`, { 
        agentId: verifier.id, agentSecret: verifier.secret, 
        asSeller: false, asVerifier: true, stake: "1.0", capHash: "0x33", pubKey: "0x44" 
    });
    console.log(`   Verifier Registered: ${EXPLORER_BASE}${r2.data.txId}`);
    await sleep(15000);
    */

    const currentCounter = await pc.readContract({ address: ESCROW_ADDR, abi, functionName: 'taskCounter' });
    const taskId = Number(currentCounter) + 1;

    console.log(`>> Creating Task ${taskId} on-chain (5.0 USDC)...`);
    const t1 = Date.now();
    const r3 = await axios.post(`${HUB_URL}/execute/createOpenTask`, {
        agentId: buyer.id, agentSecret: buyer.secret,
        amount: "5.0", jobDeadline: Math.floor(Date.now()/1000) + 3600, bidDeadline: Math.floor(Date.now()/1000) + 1800, verifierDeadline: Math.floor(Date.now()/1000) + 7200,
        taskHash: "0x" + "1".repeat(64), verifiers: [verifier.address], quorumM: 1
    });
    console.log(`   Task Created: ${EXPLORER_BASE}${r3.data.txId}`);
    await sleep(15000);

    console.log(">> Executing Bidding & Selection (On-Chain Transactions)...");
    const r4 = await axios.post(`${HUB_URL}/execute/placeBid`, { agentId: seller.id, agentSecret: seller.secret, taskId, price: "2.5", eta: 3600 });
    console.log(`   Bid Placed: ${EXPLORER_BASE}${r4.data.txId}`);
    await sleep(15000);
    const r5 = await axios.post(`${HUB_URL}/execute/selectBid`, { agentId: buyer.id, agentSecret: buyer.secret, taskId, bidIndex: 0 });
    console.log(`   Bid Selected: ${EXPLORER_BASE}${r5.data.txId}`);
    await sleep(15000);
    
    console.log(">> Executing Submission & Approval (On-Chain Transactions)...");
    const r6 = await axios.post(`${HUB_URL}/execute/submitResult`, { agentId: seller.id, agentSecret: seller.secret, taskId, hash: "0x" + "2".repeat(64), uri: "ipfs://persistent-demo" });
    console.log(`   Result Submitted: ${EXPLORER_BASE}${r6.data.txId}`);
    await sleep(15000);
    const r7 = await axios.post(`${HUB_URL}/execute/approve`, { agentId: verifier.id, agentSecret: verifier.secret, taskId });
    console.log(`   Result Approved: ${EXPLORER_BASE}${r7.data.txId}`);
    await sleep(15000);
    const r8 = await axios.post(`${HUB_URL}/execute/finalize`, { agentId: buyer.id, agentSecret: buyer.secret, taskId });
    console.log(`   Task Finalized: ${EXPLORER_BASE}${r8.data.txId}`);
    
    const t2 = Date.now();
    console.log(`\n✅ FORTRESS MISSION COMPLETE.`);
    console.log(`   Total Time: ${((t2-t1)/1000).toFixed(1)}s.`);
    console.log(`   All steps visible in your Dashboard & Monitor UI.`);
}

runFortress();
