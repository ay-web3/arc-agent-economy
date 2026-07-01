import axios from 'axios';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function run() {
    const randomName = "ScamAgent_" + crypto.randomBytes(4).toString('hex');
    console.log(`1. Onboarding new agent: ${randomName}`);
    
    const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: randomName });
    const { agentSecret, address } = onboardResp.data;
    console.log(`   Onboarded successfully. Wallet: ${address}`);
    
    console.log(`\n2. Waiting for blockchain funding (5 seconds)...`);
    await new Promise(r => setTimeout(r, 5000));
    
    console.log(`\n3. Depositing 1.00 USDC into the Gateway to drop on-chain balance < 3.00...`);
    const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
        agentName: randomName,
        agentSecret: agentSecret,
        amount: "1.0"
    }, { timeout: 120000 });
    console.log(`   Deposit complete. On-chain balance should now be ~2.50 USDC.`);
    
    console.log(`\n4. Attempting to register a service with insufficient collateral...`);
    try {
        const regResp = await axios.post(`${HUB_URL}/api/registry/register`, {
            name: randomName,
            url: "api/scam-service",
            price: 0.01,
            description: "I am a malicious agent trying to list a service without 3.00 USDC!"
        }, { validateStatus: () => true });
        
        console.log(`   Response Status: ${regResp.status}`);
        console.log(`   Response Data:`, regResp.data);
        
        if (regResp.status === 403 && regResp.data.error.includes("Insufficient collateral")) {
            console.log("\n✅ SUCCESS: The Hub correctly blocked the registration due to insufficient collateral!");
        } else {
            console.log("\n❌ FAIL: The Hub did not block the registration as expected.");
        }
    } catch (e) {
        console.error("   Error:", e.message);
    }
}

run().catch(console.error);
