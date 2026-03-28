import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [], "name": "taskCounter", "outputs": [{ "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }], "name": "verifiers", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }], "name": "tasks", "outputs": [
      { "name": "buyer", "type": "address" },
      { "name": "seller", "type": "address" },
      { "name": "price", "type": "uint256" },
      { "name": "verifierPool", "type": "uint256" },
      { "name": "sellerBudget", "type": "uint256" },
      { "name": "deadline", "type": "uint64" },
      { "name": "bidDeadline", "type": "uint64" },
      { "name": "verifierDeadline", "type": "uint64" },
      { "name": "approvalTimestamp", "type": "uint64" },
      { "name": "taskHash", "type": "bytes32" },
      { "name": "resultHash", "type": "bytes32" },
      { "name": "resultURI", "type": "string" },
      { "name": "state", "type": "uint8" },
      { "name": "quorumM", "type": "uint8" },
      { "name": "quorumN", "type": "uint8" }
    ], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const SASKE = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
    const counter = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'taskCounter' });
    
    for (let i = 1n; i <= counter; i++) {
        const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
        const state = Number(t[12]);
        if (state >= 6) continue;

        const qN = Number(t[14]);
        for (let j = 0n; j < BigInt(qN); j++) {
            try {
                const v = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'verifiers', args: [i, j] });
                if (v.toLowerCase() === SASKE.toLowerCase()) {
                    console.log(`🦅 Saske is Verifier for Task #${i} (State ${state}) at index ${j}`);
                }
            } catch (e) {}
        }
    }
}

main();
