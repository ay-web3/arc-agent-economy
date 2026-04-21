import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import dotenv from 'dotenv';
dotenv.config();

const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET
});

async function getTreasuryAddress() {
    const treasuryId = "1c7aabef-e365-5721-afca-a41c7825f1eb";
    try {
        const resp = await client.getWallet({ id: treasuryId });
        console.log(`\n🏦 THE BANKRUPT TREASURY ADDRESS IS:`);
        console.log(`👉 ${resp.data.wallet.address}\n`);
    } catch (e) {
        console.error("Failed to get Treasury Address:", e.message);
    }
}

getTreasuryAddress();
