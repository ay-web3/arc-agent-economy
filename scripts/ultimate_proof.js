
import axios from 'axios';
import { createPublicClient, http, parseAbi } from 'viem';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0xd3f6fc0d6E083C98d24eEc7140Ca49e897819B1d";

const client = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});
const abi = parseAbi(['function taskCounter() view returns (uint256)']);

async function runUltimateProof() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - THE ULTIMATE ON-CHAIN PROOF (V4)");
    console.log("================================================================");

    try {
        const ts = Date.now();
        console.log("\n[1/8] Onboarding Production Agents...");
        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Buyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Seller_" + ts })).data;
        const v = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Verifier_" + ts })).data;
        
        console.log(`>> Buyer: ${b.address}\n>> Seller: ${s.address}\n>> Verifier: ${v.address}`);

        console.log("\n[2/8] Fueling Agents (2.0 USDC each)...");
        await axios.get(`${HUB_URL}/admin/fuel-agent/${b.address}`);
        await axios.get(`${HUB_URL}/admin/fuel-agent/${s.address}`);
        await axios.get(`${HUB_URL}/admin/fuel-agent/${v.address}`);
        await new Promise(r => setTimeout(r, 25000));

        console.log("\n[3/8] Registering Seller & Verifier...");
        await axios.post(`${HUB_URL}/execute/register`, {
            agentId: s.agentId, agentSecret: s.agentSecret,
            asSeller: true, asVerifier: false, stake: "0.2",
            capHash: "0x" + "1".repeat(64), pubKey: "0x" + "2".repeat(64)
        });
        await axios.post(`${HUB_URL}/execute/register`, {
            agentId: v.agentId, agentSecret: v.agentSecret,
            asSeller: false, asVerifier: true, stake: "0.2",
            capHash: "0x" + "3".repeat(64), pubKey: "0x" + "4".repeat(64)
        });
        await new Promise(r => setTimeout(r, 20000));

        const currentCounter = await client.readContract({ address: ESCROW, abi, functionName: 'taskCounter' });
        const taskId = Number(currentCounter) + 1;

        console.log(`\n[4/8] Creating On-Chain Task ID: ${taskId} (Budget: 1.0 USDC)...`);
        await axios.post(`${HUB_URL}/execute/createOpenTask`, {
            agentId: b.agentId, agentSecret: b.agentSecret,
            amount: "1.0",
            jobDeadline: Math.floor(Date.now()/1000) + 3600,
            bidDeadline: Math.floor(Date.now()/1000) + 1800,
            verifierDeadline: Math.floor(Date.now()/1000) + 7200,
            taskHash: "0x" + "5".repeat(64),
            verifiers: [v.address], quorumM: 1
        });
        await new Promise(r => setTimeout(r, 20000));

        console.log("\n[5/8] Seller Bidding (0.5 USDC)...");
        await axios.post(`${HUB_URL}/execute/placeBid`, {
            agentId: s.agentId, agentSecret: s.agentSecret,
            taskId: taskId, price: "0.5", eta: 3600, meta: "0x" + "6".repeat(64)
        });
        await new Promise(r => setTimeout(r, 20000));

        console.log("\n[6/8] Buyer Selecting Bid...");
        await axios.post(`${HUB_URL}/execute/selectBid`, {
            agentId: b.agentId, agentSecret: b.agentSecret,
            taskId: taskId, bidIndex: 0
        });
        await new Promise(r => setTimeout(r, 20000));

        console.log("\n[7/8] Seller Submitting Result...");
        await axios.post(`${HUB_URL}/execute/submitResult`, {
            agentId: s.agentId, agentSecret: s.agentSecret,
            taskId: taskId, hash: "0x" + "7".repeat(64), uri: "ipfs://proof"
        });
        await new Promise(r => setTimeout(r, 20000));

        console.log("\n[8/8] Verifier Approving (PAYOUT)...");
        await axios.post(`${HUB_URL}/execute/approve`, {
            agentId: v.agentId, agentSecret: v.agentSecret,
            taskId: taskId
        });

        console.log("\n✅ FULL ON-CHAIN ECOSYSTEM SETTLED!");
        console.log(">> PROOF: Check the Seller's address on ARC Explorer.");
        console.log(`>> Seller: https://explorer.testnet.arc.network/address/${s.address}`);
        console.log("================================================================");

    } catch (err) {
        console.error("!! Error:", err.response?.data || err.message);
    }
}

runUltimateProof();
