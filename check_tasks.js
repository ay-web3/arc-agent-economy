import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
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

async function check() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const now = Math.floor(Date.now() / 1000);

    for (let i = 1n; i <= 20n; i++) {
        try {
            const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
            const state = Number(t[12]);
            const approvalTs = Number(t[8]);
            const price = Number(t[2]);

            console.log(`Task #${i}: State=${state}, ApprovalTs=${approvalTs}, Price=${price}, Ready=${state === 4 && now >= approvalTs + 3600}`);
        } catch (e) {
            console.log(`Task #${i}: Error reading`);
        }
    }
}
check();
