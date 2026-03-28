import { createPublicClient, http, parseAbiItem } from 'viem';
import { arcTestnet } from 'viem/chains';

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const address = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
    const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

    try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 9000n;

        console.log(`🔍 Saske: Scanning blocks ${fromBlock} to ${currentBlock} for Identity...`);

        const logs = await publicClient.getLogs({
            address: IDENTITY_REGISTRY,
            event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
            args: { to: address },
            fromBlock: fromBlock,
            toBlock: currentBlock
        });

        if (logs.length > 0) {
            console.log(`>> Success! Identity Token ID: ${logs[0].args.tokenId}`);
            console.log(`>> Current Reputation Status: 1.0 (Base Level)`);
        } else {
            console.log(">> Identity NFT not found in recent blocks. Still indexing.");
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
