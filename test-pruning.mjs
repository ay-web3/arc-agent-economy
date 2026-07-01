import axios from 'axios';
import crypto from 'crypto';

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function run() {
    const randomName = "ZombieAgent_" + crypto.randomBytes(4).toString('hex');
    console.log(`1. Onboarding new agent: ${randomName}`);
    
    const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: randomName });
    const { agentSecret, address } = onboardResp.data;
    console.log(`   Onboarded successfully. Wallet: ${address}`);
    
    console.log(`\n2. Waiting for blockchain funding (5 seconds)...`);
    await new Promise(r => setTimeout(r, 5000));
    
    console.log(`\n3. Registering service (should succeed since we have 3.5 USDC)...`);
    const regPayload = {
        name: randomName,
        url: `api/zombie-${randomName}`,
        price: 0.01,
        description: "I am a zombie agent!"
    };
    
    await axios.post(`${HUB_URL}/api/registry/register`, regPayload);
    console.log(`   Registered successfully!`);
    
    // Verify it is in the catalog
    let catalogResp = await axios.get(`${HUB_URL}/api/registry/services`);
    let listed = catalogResp.data.find(s => s.name === randomName);
    console.log(`   Is listed in catalog: ${!!listed}`);
    
    console.log(`\n4. Simulating wallet drain by depositing 1.00 USDC into the Gateway...`);
    await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
        agentName: randomName,
        agentSecret: agentSecret,
        amount: "1.0"
    }, { timeout: 120000 });
    console.log(`   Wallet drained. On-chain balance is now ~2.50 USDC.`);
    
    console.log(`\n5. Waiting 95 seconds for the pruning loop to evict the agent...`);
    
    // Simulate failed heartbeats in the background
    const hbInterval = setInterval(async () => {
        try {
            await axios.post(`${HUB_URL}/api/registry/register`, regPayload);
        } catch(e) {
            process.stdout.write("x"); // Print x for failed heartbeat
        }
    }, 10000);
    
    await new Promise(r => setTimeout(r, 95000));
    clearInterval(hbInterval);
    
    console.log(`\n\n6. Checking catalog to see if agent was pruned...`);
    catalogResp = await axios.get(`${HUB_URL}/api/registry/services`);
    listed = catalogResp.data.find(s => s.name === randomName);
    
    if (!listed) {
        console.log(`\n✅ SUCCESS: The zombie agent was successfully pruned from the catalog!`);
    } else {
        console.log(`\n❌ FAIL: The agent is STILL listed in the catalog!`);
    }
}

run().catch(console.error);
