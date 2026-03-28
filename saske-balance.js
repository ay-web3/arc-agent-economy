import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, http, formatEther } from 'viem';
import { arcTestnet } from 'viem/chains';

async function main() {
    console.log("⚔️ Saske: Checking Wallet Native Balance...");
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const secretPath = path.join(process.cwd(), './.agent_secret');
        const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
        const address = secret.address;

        const balance = await publicClient.getBalance({ 
            address: address 
        });

        console.log(`>> Wallet: ${address}`);
        console.log(`>> Native Balance: ${formatEther(balance)} ETH/USDC (Native)`);

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
