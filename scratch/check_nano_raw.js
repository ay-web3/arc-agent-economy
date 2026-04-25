
import { createPublicClient, http, parseAbi, getAddress } from 'viem';

const pc = createPublicClient({
    chain: { id: 8004, name: 'ARC Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } },
    transport: http()
});

const ESCROW = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
const BUYER = getAddress("0x220d483c914999c52e1831c42276595ed3d52ae4");

async function check() {
    const balance = await pc.readContract({
        address: ESCROW,
        abi: parseAbi(['function nanoDeposits(address) view returns (uint256)']),
        functionName: 'nanoDeposits',
        args: [BUYER]
    });
    console.log(`=== LEDGER RAW AUDIT ===`);
    console.log(`Buyer: ${BUYER}`);
    console.log(`Raw Units: ${balance.toString()}`);
    console.log(`USDC (18 dec): ${Number(balance) / 1e18}`);
    console.log(`USDC (6 dec):  ${Number(balance) / 1e6}`);
    console.log(`========================`);
}
check();
