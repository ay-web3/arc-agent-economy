import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x67471b9cca5be9831c3d4b9d7f99b17dcea9852b";
const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

const REGISTRY_ABI = [
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "profile", "outputs": [{ "name": "active", "type": "bool" }, { "name": "capabilitiesHash", "type": "bytes32" }, { "name": "pubKey", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "isSeller", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "agent", "type": "address" }], "name": "isVerifier", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("🦅 Saske: Checking agent registration...");
    
    const prof = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'profile', args: [MY_ADDRESS] });
    const seller = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isSeller', args: [MY_ADDRESS] });
    const verifier = await publicClient.readContract({ address: REGISTRY_CA, abi: REGISTRY_ABI, functionName: 'isVerifier', args: [MY_ADDRESS] });
    
    console.log(`Active: ${prof[0]}`);
    console.log(`Capabilities Hash: ${prof[1]}`);
    console.log(`Public Key: ${prof[2]}`);
    console.log(`Is Seller: ${seller}`);
    console.log(`Is Verifier: ${verifier}`);
}

main();
