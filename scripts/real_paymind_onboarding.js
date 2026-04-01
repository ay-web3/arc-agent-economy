import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import fs from 'fs';

// PAYMIND V2 CONFIG (FROM AUDIT)
const AGENT_MANAGER_ADDR = "0x65b685fCF501D085C80f0D99CFA883cFF3445ff2";
const USDC_ADDR = "0x3600000000000000000000000000000000000000";

const AGENT_MANAGER_ABI = [
  { "inputs": [{ "name": "dailyLimit", "type": "uint256" }], "name": "createAgentWallet", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "name": "user", "type": "address" }], "name": "userToAgent", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

const USDC_ABI = [
  { "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
];

async function main() {
    // 1. Setup Clients for Saske (The one who needs a wallet)
    const saskeData = JSON.parse(fs.readFileSync('.agent_secret', 'utf8'));
    const privateKey = '0x' + saskeData.agentSecret;
    const account = privateKeyToAccount(privateKey);
    
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

    console.log(`🦅 Saske: Initializing REAL PayMind V2 Wallet Creation...`);
    console.log(`>> Agent Address: ${account.address}`);

    try {
        // Step 1: Create the PayMind Agent Wallet
        console.log("\n[Step 1] Sending createAgentWallet transaction...");
        const hash = await wallet.writeContract({
            address: AGENT_MANAGER_ADDR,
            abi: AGENT_MANAGER_ABI,
            functionName: 'createAgentWallet',
            args: [parseUnits('100', 6)] // 100 USDC daily limit
        });
        
        console.log(`>> Transaction Sent! Hash: ${hash}`);
        console.log(">> Waiting for blockchain confirmation...");
        
        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`>> Status: ${receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED'}`);

        // Step 2: Verify the assignment
        const paymindWallet = await client.readContract({
            address: AGENT_MANAGER_ADDR,
            abi: AGENT_MANAGER_ABI,
            functionName: 'userToAgent',
            args: [account.address]
        });

        console.log(`\n[Step 2] PayMind Wallet Address: ${paymindWallet}`);

        // Step 3: Check USDC balance for x402 payments
        const usdcBal = await client.readContract({
            address: USDC_ADDR,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [paymindWallet]
        });
        
        console.log(`>> Current Wallet Balance: ${formatUnits(usdcBal, 6)} USDC`);

        if (usdcBal === 0n) {
            console.log("\n[Step 3] Funding the wallet for x402 Arbitrage...");
            console.log(">> Action: Please send 1.0 USDC to the PayMind Wallet above to enable real payments.");
        }

    } catch (e) {
        console.error(`!! Error during setup: ${e.message}`);
        if (e.message.includes('insufficient funds')) {
            console.log(">> Saske needs ARC gas to create the wallet. Please fund 0x3C49ed28E2918B0414140eD820D4A885B0b0FD3A.");
        }
    }
}

main();
