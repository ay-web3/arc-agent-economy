import { createPublicClient, http, parseAbi } from 'viem';

const pc = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});

const GATEWAY_ABI = parseAbi(["function availableBalance(address token, address depositor) view returns (uint256)"]);
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const USDC_CA = "0x3600000000000000000000000000000000000000";

const agents = [
    { name: "Screenshot Wallet", address: "0xabc3afc19fa3d0123bd45e418bb39cf23dd5964d" },
    { name: "Buyer", address: "0x09eed642b2a45ad10fdf91ec43054c387deab68f" },
    { name: "Seller", address: "0x6a8fb1d3f12d1e3ae0e73ed2bb03f2082542cb87" },
    { name: "Verifier", address: "0x9fd46a0510cca5e813d37298cb8c53cd6861b66f" },
    { name: "Paymind Vault", address: "0xCdA37f22f90E0fAba5916e373EF7ef98aE95D9c0" }
];

async function checkGatewayBalances() {
    console.log(`Checking GatewayWallet (${GATEWAY_WALLET}) balances...`);
    for (const agent of agents) {
        try {
            const balance = await pc.readContract({
                address: GATEWAY_WALLET,
                abi: GATEWAY_ABI,
                functionName: 'availableBalance',
                args: [USDC_CA, agent.address]
            });
            console.log(`${agent.name} (${agent.address}): ${(Number(balance) / 1e6).toFixed(6)} USDC in Gateway`);
        } catch (e) {
            console.log(`${agent.name} (${agent.address}): Error - ${e.message}`);
        }
    }
}

checkGatewayBalances();
