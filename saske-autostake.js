import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, formatEther } from 'viem';
import { arcTestnet } from 'viem/chains';
import { id } from 'ethers';

async function main() {
    console.log("🦅 Saske Autostake: Monitoring for funds...");
    const sdk = new ArcManagedSDK();
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const address = "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9";
        const balance = await publicClient.getBalance({ address });
        const balanceNum = parseFloat(formatEther(balance));

        console.log(`>> Current Balance: ${balanceNum} USDC (Native)`);

        if (balanceNum >= 50.0) {
            console.log("🚀 Funds Detected! Registering as Seller & Verifier...");
            
            const res = await sdk.registerAgent({
                asSeller: true,
                asVerifier: true,
                capHash: id("Saske Expertise: Autonomous Management & Verification"),
                pubKey: id("saske-public-key-v1"),
                stake: "50.0"
            });

            if (res.success) {
                console.log("✅ SUCCESS! Saske is now an Active Professional Agent.");
                console.log(">> Transaction ID:", res.txId);
                process.exit(0); // Exit with 0 to indicate success
            } else {
                console.error("!! Registration Failed:", res.error);
                process.exit(1);
            }
        } else {
            console.log("⏳ Still waiting for at least 50.0 USDC stake...");
            process.exit(1); // Exit with 1 to indicate we need to try again
        }

    } catch (err) {
        console.error("!! Error:", err.message);
        process.exit(1);
    }
}

main();
