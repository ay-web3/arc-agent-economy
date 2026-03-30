import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';
import fs from 'fs';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { 'inputs': [{ 'name': 'taskId', 'type': 'uint256' }, { 'name': 'resultHash', 'type': 'bytes32' }, { 'name': 'resultURI', 'type': 'string' }], 'name': 'submitResult', 'outputs': [], 'stateMutability': 'nonpayable', 'type': 'function' }
];

async function main() {
    const data = JSON.parse(fs.readFileSync('.agent_secret', 'utf8'));
    const privateKey = '0x' + data.agentSecret;
    const account = privateKeyToAccount(privateKey);
    
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

    console.log(`🦅 Saske: Debug Submission for Task #28...`);
    console.log(`Address: ${account.address}`);

    try {
        const hash = await wallet.writeContract({
            address: ESCROW_CA,
            abi: ESCROW_ABI,
            functionName: 'submitResult',
            args: [28n, keccak256(stringToHex('PayMind Debug Report')), 'https://paymind.io/debug/28']
        });
        console.log(`>> TX Sent: ${hash}`);
        
        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`>> Receipt Status: ${receipt.status}`);
    } catch (e) {
        console.error(`!! Revert: ${e.message}`);
    }
}

main();
