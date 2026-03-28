import { createPublicClient, http, formatUnits, defineChain } from 'viem';

const arcTestnet = defineChain({
  id: 2026,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.arc.fun'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://explorer.arc.fun' },
  },
});

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    let taskIdArg = process.argv[2];
    if (taskIdArg && taskIdArg.startsWith('--task-id=')) {
        taskIdArg = taskIdArg.split('=')[1];
    }
    const taskId = taskIdArg ? BigInt(taskIdArg) : 12n;
    console.log(`🔍 Checking bids for Task #${taskId}...`);
    let found = false;
    for (let i = 0n; i < 20n; i++) {
        try {
            const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, i] });
            if (bid[4]) {
                console.log(`✅ Found Bid #${i}: ${bid[0]} @ ${formatUnits(bid[1], 18)} USDC (ETA: ${bid[2]}s)`);
                found = true;
            }
        } catch (e) { break; }
    }
    if (!found) console.log(`❌ No bids found for Task #${taskId}.`);
}

main();
