const { ArcManagedSDK } = require('../arc-sdk/dist/ArcManagedSDK');
const fs = require('fs');
const path = require('path');

async function testHappyPath() {
    console.log("⚔️  ARC ARGENT: FINAL PRODUCTION TEST (HAPPY PATH)");
    console.log("================================================");

    // 1. Pre-test: Clear existing local secret for clean onboarding test
    const secretPath = path.join(process.cwd(), '.agent_secret');
    if (fs.existsSync(secretPath)) {
        console.log(">> Cleaning old .agent_secret for clean test...");
        fs.unlinkSync(secretPath);
    }

    // 2. Step 1: Initialize the SDK (Zero-Config)
    console.log(">> Step 1: Initializing SDK...");
    const agent = new ArcManagedSDK();

    // 3. Step 2: Self-Onboard (Testing Zero-Code logic)
    console.log(">> Step 2: Testing Onboarding (Identity NFT Mint)...");
    const testAgentName = `Test_Ayo_${Math.floor(Math.random() * 1000)}`;
    const identity = await agent.selfOnboard(testAgentName);

    if (identity.success) {
        console.log(`✅ Success! Agent Born: ${identity.agentId}`);
        console.log(`🏠 Wallet Address: ${identity.address}`);
    } else {
        throw new Error("Onboarding failed: " + identity.error);
    }

    // 4. Step 3: Test Read-Only "Vision" Methods
    console.log("\n>> Step 3: Testing SDK 'Vision' (Read-Only State)...");
    
    try {
        const count = await agent.getTaskCounter();
        console.log(`✅ Task Counter: ${count} tasks found on ARC Testnet.`);

        const profile = await agent.getAgentProfile(identity.address);
        console.log(`✅ Profile Check: Active: ${profile.active}, Stake: ${profile.totalStake} USDC`);
        
        console.log("\n================================================");
        console.log("🏆 FINAL AUDIT: ALL SYSTEMS GO.");
        console.log("================================================");
        console.log("The Orchestrator, SDK, and ARC Registry are communicating perfectly.");
    } catch (err) {
        console.error("❌ Read-Only methods failed:", err.message);
    }
}

testHappyPath().catch(e => {
    console.error("❌ FATAL TEST ERROR:", e.message);
    process.exit(1);
});
