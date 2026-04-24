
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';

const client = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});

const USDC_CA = "0x3600000000000000000000000000000000000000";
const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

async function check() {
    const addr = "0xabc3afc19fa3d0123bd45e418bb39cf23dd5964d";
    try {
        const bal = await client.readContract({
            address: USDC_CA,
            abi,
            functionName: 'balanceOf',
            args: [addr]
        });
        console.log(`Balance of ${addr}: ${formatUnits(bal, 18)} USDC`);
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
check();
