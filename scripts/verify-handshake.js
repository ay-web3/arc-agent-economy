const axios = require('axios');
const ORCHESTRATOR = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function run() {
    console.log("⚔️  ARC ARGENT: HANDSHAKE VERIFICATION");
    console.log("================================================");

    try {
        const id = Date.now();
        console.log(`\n[1/2] Birthing Verification Agent: Sim_Internal_Ayo_Test_${id}...`);
        
        const response = await axios.post(`${ORCHESTRATOR}/onboard`, { 
            agentName: `Sim_Internal_Ayo_Test_${id}` 
        });
        
        if (response.data.success) {
            console.log("✅ ONBOARDING SUCCESSFUL");
            console.log(`🏠 ADDRESS: ${response.data.address}`);
            console.log(`🎨 IDENTITY NFT: ${response.data.identityTxId ? "MINTED (" + response.data.identityTxId + ")" : "PENDING"}`);
            
            console.log("\n[2/2] Checking On-Chain Balance (Wait 10s)...");
            await new Promise(r => setTimeout(r, 10000));
            
            const balRes = await axios.get(`https://rpc.testnet.arc.network/api?module=account&action=balance&address=${response.data.address}`);
            // Note: Simplistic check via RPC (or we can use our SDK vision)
            const profile = await axios.get(`${ORCHESTRATOR}/registry/profile/${response.data.address}`);
            console.log(`✅ BALANCE CHECK: ${profile.data.availableStake} USDC available in registry.`);
            
            console.log("\n================================================");
            console.log("🏁 VERIFICATION COMPLETE.");
        }
    } catch (err) {
        console.error("❌ Handshake Failed:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}
run();
