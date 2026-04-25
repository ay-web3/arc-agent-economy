
import { createPublicClient, http, parseAbi } from 'viem';

const pc = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});

const USDC_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const NATIVE_USDC = "0x3600000000000000000000000000000000000000";

const agents = [
    { name: "Buyer", address: "0x09eed642b2a45ad10fdf91ec43054c387deab68f" },
    { name: "Seller", address: "0x6a8fb1d3f12d1e3ae0e73ed2bb03f2082542cb87" },
    { name: "Verifier", address: "0x9fd46a0510cca5e813d37298cb8c53cd6861b66f" },
    { name: "Paymind Vault", address: "0xCdA37f22f90E0fAba5916e373EF7ef98aE95D9c0" }
];

async function check() {
    for (const agent of agents) {
        try {
            const balance = await pc.readContract({
                address: NATIVE_USDC,
                abi: USDC_ABI,
                functionName: 'balanceOf',
                args: [agent.address]
            });
            console.log(`${agent.name} (${agent.address}): ${(Number(balance) / 1e6).toFixed(6)} USDC`);
        } catch (e) {
            console.log(`${agent.name} (${agent.address}): Error - ${e.message}`);
        }
    }
}

check();
