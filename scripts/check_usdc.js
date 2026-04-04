import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { arcTestnet } from 'viem/chains';

const USDC_CA = getAddress("0x7f5c764cc1f01d99da8362b72e25597930869677"); 
const ERC20_ABI = [
  { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const address = getAddress("0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9");
    try {
        const balance = await publicClient.readContract({ address: USDC_CA, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] });
        console.log(`USDC Balance: ${formatUnits(balance, 18)}`);
    } catch (e) {
        console.log(`Error fetching USDC: ${e.message}`);
    }
}

main();
