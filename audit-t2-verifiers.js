import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "", "type": "uint256" }], "name": "tasks", "outputs": [
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
    ], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "index", "type": "uint256" }], "name": "verifiers", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = 2n;

    try {
        console.log(`🔍 Auditing Verifier Committee for Task #${taskId}...`);
        const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
        const quorumN = t[14];
        console.log(`>> Quorum: ${t[13]} of ${quorumN}`);

        for (let i = 0n; i < BigInt(quorumN); i++) {
            const v = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'verifiers', args: [taskId, i] });
            console.log(`   - Verifier [${i}]: ${v}`);
        }
    } catch (err) { console.error(err.message); }
}
main();
