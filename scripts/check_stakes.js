import { createPublicClient, http, parseAbi, defineChain } from 'viem';

const arcTestnet = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.testnet.arc.network'] },
    },
    blockExplorers: {
        default: { name: 'ARC Explorer', url: 'https://explorer.testnet.arc.network' },
    },
    testnet: true,
});

const REGISTRY = "0x9C2e68251E91dD9724feD8E6D270bC7542273d0C";

async function check() {
    const pc = createPublicClient({ chain: arcTestnet, transport: http() });
    const abi = parseAbi([
        'function minSellerStake() view returns (uint256)',
        'function minVerifierStake() view returns (uint256)'
    ]);

    const minSeller = await pc.readContract({ address: REGISTRY, abi, functionName: 'minSellerStake' });
    const minVerifier = await pc.readContract({ address: REGISTRY, abi, functionName: 'minVerifierStake' });

    console.log(`Min Seller: ${minSeller.toString()} (${Number(minSeller) / 1e18} USDC)`);
    console.log(`Min Verifier: ${minVerifier.toString()} (${Number(minVerifier) / 1e18} USDC)`);
}

check();
