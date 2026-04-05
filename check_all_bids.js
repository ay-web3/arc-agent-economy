import { createPublicClient, http, parseAbiItem, getAddress } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = getAddress("0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c");

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    console.log(`Checking all BidPlaced events in recent blocks...`);
    try {
        const logs = await publicClient.getLogs({
            address: ESCROW_CA,
            event: parseAbiItem("event BidPlaced(uint256 indexed taskId, address indexed bidder, uint256 price)"),
            fromBlock: 35396312n 
        });
        if (logs.length === 0) {
            console.log("No BidPlaced events found.");
        } else {
            logs.forEach((log, index) => {
                console.log(`Log #${index}: Task #${log.args.taskId}, bidder=${log.args.bidder}, price=${log.args.price}`);
            });
        }
    } catch (e) {
        console.error("Error fetching logs:", e.message);
    }
}

main();
