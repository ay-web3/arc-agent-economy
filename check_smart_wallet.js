import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { arcTestnet } from 'viem/chains';

const USDC_CA = getAddress("0x1b1d120a174c81413f17079208003a27076a0d4c"); 
const SMART_WALLET = getAddress("0x662965B94b59ea67EfE0eECE921A593ABC5e3287");
const ERC20_ABI = [
  { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    try {
        const balance = await publicClient.readContract({ address: USDC_CA, abi: ERC20_ABI, functionName: 'balanceOf', args: [SMART_WALLET] });
        console.log(`Smart Wallet USDC Balance: ${formatUnits(balance, 6)}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

main();
