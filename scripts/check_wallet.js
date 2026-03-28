import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { arcTestnet } from 'viem/chains';

const MY_ADDRESS = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
const USDC_CA = "0x1b1d120a174c81413f17079208003a27076a0d4c";

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    
    console.log("🦅 Saske: Checking wallet balance...");
    
    const balance = await publicClient.getBalance({ address: MY_ADDRESS });
    console.log(`ARC Balance: ${formatEther(balance)} ARC`);

    try {
        const usdcBalance = await publicClient.readContract({
            address: USDC_CA,
            abi: [{ "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }],
            functionName: 'balanceOf',
            args: [MY_ADDRESS]
        });
        console.log(`USDC Balance: ${formatUnits(usdcBalance, 6)} USDC`);
    } catch (e) {
        console.log("Could not fetch USDC balance.");
    }
}

main();
