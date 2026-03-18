const { createClient } = require('@circle-fin/developer-controlled-wallets');
const crypto = require('crypto');

const API_KEY = 'TEST_API_KEY:e4be546312f6e6cd3998e99be06492f0:ef69015ab2bd28a5d6191a2cdcd41c21';
const ENTITY_SECRET = '1a388c92301dd68a676df6ac47358f25037fade6da9231264a4dd3317fc6f8f6';
const WALLET_ID = 'd654af80-6f29-578c-b758-24dab91f73a0';
const NATIVE_USDC_ADDR = "0x3600000000000000000000000000000000000000";
const TARGET = "0x2d0c0121e440779b762c086d77086d42232c7aa7";

async function main() {
    // 1. Initialize official Circle SDK
    const client = createClient({
        apiKey: API_KEY,
        entitySecret: ENTITY_SECRET
    });

    console.log(`🚀 Using Official Circle SDK for Smart Transfer on ARC-TESTNET...`);

    try {
        // 2. Execute transaction using the SDK's built-in routing
        const response = await client.createTransaction({
            idempotencyKey: crypto.randomUUID(),
            walletId: WALLET_ID,
            blockchain: "ARC-TESTNET",
            contractAddress: NATIVE_USDC_ADDR,
            abiFunctionSignature: "transfer(address,uint256)",
            abiParameters: [TARGET, "1000000"], // 1.0 USDC
            fee: {
                type: "level",
                config: { feeLevel: "MEDIUM" }
            }
        });

        console.log("\n✅ SUCCESS VIA SDK!");
        console.log("Transaction Hash:", response.data.txHash);
        console.log("Transaction ID:", response.data.id);

    } catch (error) {
        console.error("\n❌ SDK TRANSFER FAILED");
        console.error(error);
    }
}

main();
