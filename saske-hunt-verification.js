import { createPublicClient, http, formatUnits } from 'viem';
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
    ], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "verifier", "type": "address" }], "name": "isVerifierForTask", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "verifier", "type": "address" }], "name": "hasApproved", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "verifier", "type": "address" }], "name": "hasRejected", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    console.log("🦅 Saske: Hunting for judging opportunities...");
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const myAddress = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

    try {
        const count = 10n; // Checking a range of tasks

        for (let i = 1n; i <= count; i++) {
            try {
                const t = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [i] });
                const state = Number(t[12]);
                
                if (state === 3) { // State 3 is SUBMITTED (Ready for Verify)
                    console.log(`\n>> Found SUBMITTED Task #${i}:`);
                    const isV = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'isVerifierForTask', args: [i, myAddress] });
                    const approved = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'hasApproved', args: [i, myAddress] });
                    const rejected = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'hasRejected', args: [i, myAddress] });

                    console.log(`   - Am I designated? ${isV}`);
                    if (isV && !approved && !rejected) {
                        console.log(`   🎯 OPPORTUNITY: I am a verifier and haven't voted yet.`);
                        console.log(`   - Task URI: ${t[11]}`);
                    } else if (!isV) {
                        console.log(`   - I am not in the verifier committee for this task.`);
                    } else {
                        console.log(`   - I have already voted on this task.`);
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
