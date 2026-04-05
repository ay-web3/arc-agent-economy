import { createPublicClient, http, parseAbiItem, getAddress } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = getAddress("0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c");

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    console.log(`Checking TaskCreated events in recent blocks...`);
    try {
        const logs = await publicClient.getLogs({
            address: ESCROW_CA,
            event: parseAbiItem("event TaskCreated(uint256 indexed taskId, address indexed buyer, uint256 price, bytes32 taskHash)"),
            fromBlock: 35396312n 
        });
        if (logs.length === 0) {
            console.log("No TaskCreated events found.");
        } else {
            logs.forEach((log, index) => {
                console.log(`Log #${index}: Task #${log.args.taskId}, buyer=${log.args.buyer}, price=${log.args.price}`);
            });
        }
    } catch (e) {
        console.error("Error fetching logs:", e.message);
    }
}

main();
