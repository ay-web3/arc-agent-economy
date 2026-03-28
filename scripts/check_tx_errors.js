import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("🦅 Saske: Checking recent transaction history for errors...");
    
    const blockNumber = await publicClient.getBlockNumber();
    const startBlock = blockNumber - 5000n;
    
    console.log(`>> Scanning blocks ${startBlock} to ${blockNumber}...`);
    
    // Note: viem doesn't have a direct 'getTransactionsForAddress' without an indexer.
    // We'll look for events we emitted or just check the most recent few blocks manually
    // or use a public API if available.
    
    // Instead, let's just try to fetch the address on a mock explorer or check status codes
    // if the RPC supports eth_getTransactionByHash for recent ones.
    
    // Let's check for Task #23 cancellation tx if we have it in logs.
    // Actually, I'll just check if Task #2 has been finalized.
}

main();
