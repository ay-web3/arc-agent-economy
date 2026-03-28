import { createPublicClient, http, formatEther } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x67471b9cca5be9831c3d4b9d7f99b17dcea9852b";
const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

const REGISTRY_ABI = [
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "stakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "lockedStakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "availableStake", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("🦅 Saske: Checking stake balance...");
    
    const stake = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'stakeOf', args: [MY_ADDRESS] });
    const locked = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'lockedStakeOf', args: [MY_ADDRESS] });
    const available = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'availableStake', args: [MY_ADDRESS] });
    
    console.log(`Stake: ${formatEther(stake)} ARC`);
    console.log(`Locked: ${formatEther(locked)} ARC`);
    console.log(`Available: ${formatEther(available)} ARC`);
}

main();
