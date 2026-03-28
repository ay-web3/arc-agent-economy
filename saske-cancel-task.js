import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
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

async function main() {
    const args = process.argv.slice(2);
    let taskIdArg = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--id=')) taskIdArg = args[i].split('=')[1];
        else if (args[i] === '--id' && args[i+1]) taskIdArg = args[i+1];
        else if (args[i].startsWith('--task-id=')) taskIdArg = args[i].split('=')[1];
        else if (args[i] === '--task-id' && args[i+1]) taskIdArg = args[i+1];
    }

    if (!taskIdArg) {
        console.error("Usage: node saske-cancel-task.js --id=<taskId>");
        process.exit(1);
    }

    const taskId = BigInt(taskIdArg);
    console.log(`🦅 Saske: Attempting to cancel Task #${taskId}...`);

    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const task = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'tasks', args: [taskId] });
        const now = Math.floor(Date.now() / 1000);
        const bidDeadline = Number(task[6]);
        const state = Number(task[12]);

        console.log(`>> Current State: ${state}`);
        console.log(`>> Bid Deadline: ${bidDeadline} (Now: ${now})`);

        if (state === 7) {
            console.log(`✅ Task #${taskId} is already Cancelled.`);
            return;
        }

        if (now < bidDeadline) {
            console.log(`⏳ Bidding is still open. I cannot cancel yet via 'cancelIfNoBids'.`);
            console.log(`>> Please wait ${bidDeadline - now} seconds...`);
        } else {
            console.log(`🚀 Bidding closed. Checking for bids and attempting cancellation...`);
            const res = await sdk.cancelIfNoBids(taskId.toString());
            if (res.success) {
                console.log(`✅ Task #${taskId} Cancelled successfully. Funds returned to wallet.`);
            } else {
                console.error(`!! Cancellation failed: ${res.error}`);
            }
        }
    } catch (err) {
        console.error(`!! Error: ${err.message}`);
    }
}

main();
