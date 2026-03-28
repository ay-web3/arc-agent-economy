import { createPublicClient, http, parseAbiItem } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 10000n;

        console.log(`⚔️ Saske: Scanning logs from block ${fromBlock} to ${currentBlock}...`);
        
        const logs = await publicClient.getLogs({
            address: ESCROW_CA,
            event: parseAbiItem("event TaskOpen(uint256 indexed taskId, uint256 totalEscrow, uint256 sellerBudget, uint256 verifierPool, uint64 bidDeadline)"),
            fromBlock: fromBlock,
            toBlock: currentBlock
        });

        console.log(`>> Found ${logs.length} TaskOpen events in recent blocks.`);
        logs.forEach(log => {
            console.log(`   - Task #${log.args.taskId}: Seller Budget ${log.args.sellerBudget}, Deadline ${log.args.bidDeadline}`);
        });

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
