import { createPublicClient, http, formatEther } from 'viem';
import { arcTestnet } from 'viem/chains';

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const balance = await publicClient.getBalance({ address: "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9" });
    console.log(`Native Balance: ${formatEther(balance)} USDC`);
}

main();
