
import { createPublicClient, http, parseAbi } from 'viem';

const pc = createPublicClient({
    chain: { id: 8004, name: 'ARC Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } },
    transport: http()
});

const ESCROW = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
const BUYER_CHECKSUM = "0x220D483c914999C52E1831c42276595Ed3D52Ae4";
const BUYER_LOWER = "0x220d483c914999c52e1831c42276595ed3d52ae4";

async function check() {
    const abi = parseAbi(['function nanoDeposits(address) view returns (uint256)']);
    
    const bal1 = await pc.readContract({ address: ESCROW, abi, functionName: 'nanoDeposits', args: [BUYER_CHECKSUM] });
    const bal2 = await pc.readContract({ address: ESCROW, abi, functionName: 'nanoDeposits', args: [BUYER_LOWER] });

    console.log(`=== LEDGER DEEP AUDIT ===`);
    console.log(`Checksummed: ${BUYER_CHECKSUM} -> ${bal1.toString()} units`);
    console.log(`Lowercase:    ${BUYER_LOWER} -> ${bal2.toString()} units`);
    console.log(`=========================`);
}
check();
