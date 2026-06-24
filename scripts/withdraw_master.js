import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { createPublicClient, http, parseAbi } from 'viem';
import { v4 as uuidv4 } from 'uuid';

const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET
});

const USDC_CA = "0x3600000000000000000000000000000000000000";
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const pc = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});

const GATEWAY_ABI = parseAbi([
    "function balances(address account, address token) view returns (uint256)",
    "function withdraw(address token, uint256 amount)"
]);

async function run() {
    try {
        const walletId = process.env.MASTER_WALLET_ID;
        console.log(`Getting wallet details for ${walletId}...`);
        const wResp = await client.getWallet({ id: walletId });
        const address = wResp.data.wallet.address;
        console.log(`Master Wallet Address: ${address}`);

        let balance = 0n;
        try {
            balance = await pc.readContract({
                address: GATEWAY_WALLET,
                abi: GATEWAY_ABI,
                functionName: 'balances',
                args: [address, USDC_CA]
            });
            console.log(`Gateway Balance: ${(Number(balance) / 1e6).toFixed(6)} USDC`);
        } catch (err) {
            console.error("Could not read balance mapping (maybe different ABI):", err.message);
            // fallback: attempt to withdraw some fixed amount or we fail
            return;
        }

        if (balance > 0n) {
            console.log(`Withdrawing ${balance}...`);
            const withdrawResp = await client.createContractExecutionTransaction({
                idempotencyKey: uuidv4(),
                walletId: walletId,
                blockchain: "ARC-TESTNET",
                abiFunctionSignature: "withdraw(address,uint256)",
                abiParameters: [USDC_CA, balance.toString()],
                contractAddress: GATEWAY_WALLET,
                fee: { type: "level", config: { feeLevel: "MEDIUM" } }
            });

            const txId = withdrawResp.data?.transaction?.id || withdrawResp.data?.id;
            console.log(`Withdraw TX queued: ${txId}`);

            // Wait for completion
            let withdrawState = "QUEUED";
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const txCheck = await client.getTransaction({ id: txId });
                    withdrawState = txCheck.data?.transaction?.state || "UNKNOWN";
                    if (withdrawState === "COMPLETE" || withdrawState === "CONFIRMED") break;
                    if (withdrawState === "FAILED" || withdrawState === "DENIED") {
                        throw new Error(`Withdraw TX failed: ${withdrawState}`);
                    }
                } catch(e) {}
            }
            console.log(`Withdraw TX state: ${withdrawState}`);
        } else {
            console.log("No balance to withdraw.");
        }

    } catch (e) {
        console.error("Error:", e.response?.data || e.message);
    }
}

run();
