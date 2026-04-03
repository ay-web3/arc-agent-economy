import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

const ESCROW_ABI = [
    { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "verifier", "type": "address" }], "name": "isVerifierForTask", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [{ "name": "buyer", "type": "address" }, { "name": "seller", "type": "address" }, { "name": "price", "type": "uint256" }, { "name": "verifierPool", "type": "uint256" }, { "name": "sellerBudget", "type": "uint256" }, { "name": "deadline", "type": "uint64" }, { "name": "bidDeadline", "type": "uint64" }, { "name": "verifierDeadline", "type": "uint64" }, { "name": "approvalTimestamp", "type": "uint64" }, { "name": "taskHash", "type": "bytes32" }, { "name": "resultHash", "type": "bytes32" }, { "name": "resultURI", "type": "string" }, { "name": "state", "type": "uint8" }, { "name": "quorumM", "type": "uint8" }, { "name": "quorumN", "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const states = ["NONE", "CREATED", "ACCEPTED", "SUBMITTED", "QUORUM_APPROVED", "REJECTED", "FINALIZED", "TIMEOUT_REFUNDED", "DISPUTED", "RESOLVED"];

    console.log("🦅 Saske: Checking for tasks where I am a verifier...");

    for (let i = 1n; i <= 100n; i++) {
        try {
            const isV = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'isVerifierForTask', args: [i, MY_ADDRESS] });
            if (isV) {
                const task = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
                const stateStr = states[task[12]];
                console.log(`Task #${i}: State=${stateStr}. I am a verifier!`);
            }
        } catch (err) {}
    }
}

main();
