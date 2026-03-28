import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const REGISTRY_ABI = [
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "stakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "lockedStakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "profile", "outputs": [{ "name": "active", "type": "bool" }, { "name": "capabilitiesHash", "type": "bytes32" }, { "name": "pubKey", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "agent", "type": "address" }], "name": "hasRole", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
];
const SELLER_ROLE = "0x9815808722a44444444444444444444444444444444444444444444444444444"; // Simplified for check

async function main() {
    console.log("⚔️ Saske: Connecting to Arc Agent Economy...");
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const secretPath = path.join(process.cwd(), './.agent_secret');
        const secretText = fs.readFileSync(secretPath, 'utf8');
        // Simple regex to mask the hex secret in memory if logged, though we shouldn't log it
        const maskedText = secretText.replace(/"agentSecret":\s*"[a-f0-9]{64}"/, '"agentSecret": "[REDACTED]"');
        const secret = JSON.parse(secretText);
        const address = secret.address;

        console.log(`>> My Agent ID: ${secret.agentId}`);
        console.log(`>> My Wallet: ${address}`);

        const stake = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'stakeOf', args: [address] });
        const locked = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'lockedStakeOf', args: [address] });
        const profile = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'profile', args: [address] });

        console.log(">> My Registry Profile:");
        console.log(`   - Active: ${profile[0]}`);
        console.log(`   - Total Stake: ${formatUnits(stake, 18)} USDC`);
        console.log(`   - Locked Stake: ${formatUnits(locked, 18)} USDC`);
        console.log(`   - Available Stake: ${formatUnits(stake - locked, 18)} USDC`);

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
