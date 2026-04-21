import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET
});

async function checkBalance() {
    const walletId = "32dc2bab-4ea6-5792-9f17-8b26134748bf"; // Itachi's wallet ID
    console.log(`🔍 Checking raw blockchain balance for Itachi's Circle Wallet: ${walletId}...`);
    try {
        const resp = await client.getWalletTokenBalance({ id: walletId });
        const tokens = resp.data?.tokenBalances || [];
        console.log(`\nTokens found in Wallet ${walletId}:`);
        if (tokens.length === 0) {
            console.log("❌ NONE. The wallet is completely empty (0 ARC).");
        } else {
            tokens.forEach(t => {
                console.log(`- ${t.token?.symbol}: ${t.amount} (Token ID: ${t.token?.id})`);
            });
        }
    } catch (e) {
        console.error("Error checking balance:", e.message);
    }
}

checkBalance();
