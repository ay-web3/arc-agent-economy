import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const MY_WALLET = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 10000n; // viem eth_getLogs limit

        console.log(`Searching for TaskFinalized events from block ${fromBlock} to ${currentBlock}...`);

        const logs = await publicClient.getLogs({
            address: ESCROW_CA,
            event: parseAbiItem("event TaskFinalized(uint256 indexed taskId, address indexed buyer, address indexed seller, uint256 price, uint256 verifierPayout)"),
            fromBlock: fromBlock,
            toBlock: currentBlock
        });

        console.log(`Found ${logs.length} TaskFinalized events.`);
        let myEarnings = 0n;

        logs.forEach(log => {
            const { taskId, seller, price } = log.args;
            if (seller.toLowerCase() === MY_WALLET.toLowerCase()) {
                console.log(`   - Task #${taskId}: Earned ${formatUnits(price, 18)} USDC`);
                myEarnings += price;
            }
        });

        console.log(`Total USDC earned in this period: ${formatUnits(myEarnings, 18)} USDC`);

    } catch (err) {
        console.error("Error:", err.message);
    }
}

main();
