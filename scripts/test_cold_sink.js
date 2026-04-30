import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

const HUB_URL = "http://localhost:3000";

async function testColdSink() {
    console.log("================================================================");
    console.log("🔒 ARC AGENT ECONOMY: COLD STORAGE SINK TEST");
    console.log("================================================================\n");

    const sdk = new ArcManagedSDK({ orchestratorUrl: HUB_URL, secretPath: './.coldsink_secret' });
    const agentName = `ColdTester_${Math.floor(Math.random() * 1000)}`;
    const myColdWallet = "0x" + "1".repeat(40); // Mock cold wallet: 0x1111...

    console.log(`>> [1] Onboarding ${agentName} with Cold Wallet: ${myColdWallet}`);
    try {
        const onboardResp = await sdk.selfOnboard(agentName, "ipfs://mock", myColdWallet);
        console.log(`   [SUCCESS] Agent Onboarded. Wallet ID: ${onboardResp.address}`);
        console.log(`   [INFO] Hub Sponsored Gas Tx: ${onboardResp.sponsorshipTxId}`);
        
        console.log("\n>> [WAIT] Allowing time for sponsored USDC to settle...");
        await new Promise(resolve => setTimeout(resolve, 8000));

        console.log(`\n>> [2] SIMULATING HACK: Attempting to withdraw profits`);
        console.log(`   [INFO] The hacker attempts to run 'withdrawProfitsToColdWallet'`);
        
        const withdrawResp = await sdk.withdrawProfitsToColdWallet("0.001");
        
        console.log(`\n✅ [SECURITY VERIFIED] Withdrawal Processed!`);
        console.log(`   Tx ID: ${withdrawResp.txId}`);
        console.log(`   Forced Destination: ${withdrawResp.destination}`);
        
        if (withdrawResp.destination.toLowerCase() === myColdWallet.toLowerCase()) {
            console.log("\n🔒 SUCCESS: The Hub strictly enforced the Cold Storage Sink.");
            console.log("   The hacker successfully... sent the money to the creator's cold wallet.");
        } else {
            console.log("\n❌ ERROR: Destination mismatch.");
        }
    } catch (err) {
        console.error("\n❌ Test Failed:", err?.response?.data || err.message);
    }
}

testColdSink();
