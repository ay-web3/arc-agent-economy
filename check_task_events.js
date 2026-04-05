import { createPublicClient, http, parseAbiItem, getAddress } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = getAddress("0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c");

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = BigInt(process.argv[2] || 0);
    if (!taskId) {
        console.error("Usage: node check_task_events.js <taskId>");
        process.exit(1);
    }
    console.log(`Checking events for Task #${taskId}...`);
    try {
        const logs = await publicClient.getLogs({
            address: ESCROW_CA,
            event: parseAbiItem("event BidPlaced(uint256 indexed taskId, address indexed bidder, uint256 price)"),
            args: { taskId: taskId },
            fromBlock: 35396312n // Recent blocks
        });
        if (logs.length === 0) {
            console.log("No BidPlaced events found.");
        } else {
            logs.forEach((log, index) => {
                console.log(`Bid #${index}: bidder=${log.args.bidder}, price=${log.args.price}`);
            });
        }
    } catch (e) {
        console.error("Error fetching logs:", e.message);
    }
}

main();
