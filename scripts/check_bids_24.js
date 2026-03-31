import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "taskId", "type": "uint256" }, { "name": "bidIndex", "type": "uint256" }], "name": "bids", "outputs": [{ "name": "bidder", "type": "address" }, { "name": "bidPrice", "type": "uint256" }, { "name": "etaSeconds", "type": "uint64" }, { "name": "metaHash", "type": "bytes32" }, { "name": "exists", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = 24n;
    console.log(`Checking bids for Task #${taskId}...`);
    for (let b = 0n; b < 10n; b++) {
        try {
            const bid = await publicClient.readContract({ address: ESCROW_CA, abi: ESCROW_ABI, functionName: 'bids', args: [taskId, b] });
            console.log(`Bid #${b}: exists=${bid[4]}, bidder=${bid[0]}, price=${formatUnits(bid[1], 18)}`);
        } catch (e) { 
            console.log(`Bid #${b}: error ${e.message}`);
            break; 
        }
    }
}

main();
