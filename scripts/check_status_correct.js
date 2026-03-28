import { createPublicClient, http, formatEther } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

const REGISTRY_ABI = [
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "stakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "lockedStakeOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "availableStake", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "profile", "outputs": [{ "name": "active", "type": "bool" }, { "name": "capabilitiesHash", "type": "bytes32" }, { "name": "pubKey", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "isSeller", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "isVerifier", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("🦅 Saske: Checking stake and registration on Correct Registry...");
    
    const stake = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'stakeOf', args: [MY_ADDRESS] });
    const available = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'availableStake', args: [MY_ADDRESS] });
    const prof = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'profile', args: [MY_ADDRESS] });
    const seller = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isSeller', args: [MY_ADDRESS] });
    const verifier = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isVerifier', args: [MY_ADDRESS] });
    
    console.log(`Stake: ${formatEther(stake)} ARC`);
    console.log(`Available: ${formatEther(available)} ARC`);
    console.log(`Active: ${prof[0]}`);
    console.log(`Is Seller: ${seller}`);
    console.log(`Is Verifier: ${verifier}`);
}

main();
