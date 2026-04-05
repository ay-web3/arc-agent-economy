import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import axios from 'axios';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import fs from 'fs';

const USDC_CA = '0x3600000000000000000000000000000000000000';
const ORCHESTRATOR = "https://arc-agent-economy-156980607075.europe-west1.run.app";

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    // 1. Setup Saske (The Funder)
    const saskeData = JSON.parse(fs.readFileSync('.agent_secret', 'utf8'));
    const saskeAccount = privateKeyToAccount('0x' + saskeData.agentSecret);
    const saskeWallet = createWalletClient({ account: saskeAccount, chain: arcTestnet, transport: http() });

    console.log("🦅 Swarm Manager: Activating new Autonomous Agent...");

    // 2. Onboard New Agent
    const onboard = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName: `Swarm_Agent_${Date.now()}` });
    const bot = onboard.data;
    console.log(`>> Agent Born: ${bot.address}`);

    // 3. Fund New Agent (55 USDC)
    console.log(`>> Funding new agent with 55 USDC for stake...`);
    const fundTx = await saskeWallet.writeContract({
        address: USDC_CA,
        abi: [{ 'inputs': [{ 'name': 'to', 'type': 'address' }, { 'name': 'amount', 'type': 'uint256' }], 'name': 'transfer', 'outputs': [{ 'name': '', 'type': 'bool' }], 'stateMutability': 'nonpayable', 'type': 'function' }],
        functionName: 'transfer',
        args: [bot.address, parseUnits('55', 6)]
    });
    console.log(`>> Funding TX: ${fundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    console.log(`>> Funding Confirmed.`);

    // 4. Register New Agent as Seller
    console.log(`>> Registering Agent in the Registry...`);
    
    const regRes = await axios.post(`${ORCHESTRATOR}/execute/register`, {
        agentId: bot.agentId,
        agentSecret: bot.agentSecret,
        asSeller: true,
        asVerifier: false,
        capHash: keccak256(toBytes("General Intelligence, Coding, Auditing")),
        pubKey: keccak256(toBytes(bot.address)),
        stake: "50.0"
    });
    
    if (!regRes.data.success) throw new Error("Registration failed: " + regRes.data.error);
    console.log(`>> Registration SUCCESS. Agent is now a verified Seller.`);

    // 5. Place Bids on Open Tasks (#43, #44, #45)
    const tasks = [43, 44, 45];
    for (const id of tasks) {
        console.log(`>> Bidding on Task #${id}...`);
        const bidRes = await axios.post(`${ORCHESTRATOR}/execute/placeBid`, {
            agentId: bot.agentId,
            agentSecret: bot.agentSecret,
            taskId: id.toString(),
            price: "4.0",
            eta: 1800,
            meta: id === 43 ? "Deterministic Discovery Bid" : "Swarm Bid"
        });
        console.log(`   - Result: ${bidRes.data.success ? 'SUCCESS' : 'FAILED'}`);
    }

    console.log("\n✅ SWARM EXPANSION COMPLETE.");
    console.log("Status: 1 New Agent Registered & Bidding.");
}

main();
