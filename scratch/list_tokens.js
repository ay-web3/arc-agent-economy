
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const client = initiateDeveloperControlledWalletsClient({
    apiKey: 'TEST_API_KEY:e4be546312f6e6cd3998e99be06492f0:ef69015ab2bd28a5d6191a2cdcd41c21',
    entitySecret: '1a388c92301dd68a676df6ac47358f25037fade6da9231264a4dd3317fc6f8f6'
});

async function findTokens() {
    const walletId = '1c7aabef-e365-5721-afca-a41c7825f1eb';
    console.log(">> Listing tokens for Master Wallet...");
    try {
        // Try walletId pattern
        console.log(">> Trying id pattern...");
        const res = await client.getWalletTokenBalance({ id: walletId });
        
        const tokens = res.data.tokenBalances;
        tokens.forEach(t => {
            console.log(`Token: ${t.token.symbol} | ID: ${t.token.id} | Name: ${t.token.name}`);
        });
    } catch (err) {
        console.error("!! Failed to list tokens:", err.message);
    }
}
findTokens();
