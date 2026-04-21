const axios = require('axios');
const readline = require('readline');
const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ADMIN_SECRET = "SENTINEL_ADMIN_2026_SWARM";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function waitManual(msg) {
    return new Promise(resolve => rl.question(`\n⚠️  [ACTION REQUIRED] ${msg}\n>> Press ENTER once funded: `, () => resolve()));
}

async function run() {
    console.log("\n🚀 INITIALIZING ULTIMA PROTOCOL SWARM (ROLE-SPECIFIC FUNDING)...");
    
    try {
        // --- PHASE 1: BIRTH ---
        console.log("\n🐣 PHASE 1: BIRTH & IDENTITY...");
        
        const bName = `sim-buyer-${Math.random().toString(36).slice(2,6)}`;
        const sName = `sim-seller-${Math.random().toString(36).slice(2,6)}`;
        const vName = `sim-verifier-${Math.random().toString(36).slice(2,6)}`;

        console.log(`>> Onboarding Agents: ${bName}, ${sName}, ${vName}...`);
        const [buyer, seller, verifier] = await Promise.all([
            axios.post(`${HUB_URL}/onboard`, { agentName: bName }).then(r => r.data),
            axios.post(`${HUB_URL}/onboard`, { agentName: sName }).then(r => r.data),
            axios.post(`${HUB_URL}/onboard`, { agentName: vName }).then(r => r.data)
        ]);

        console.log(`\n✅ TRI-AGENT BORN:`);
        console.log(`   BUYER:    ${buyer.address} -> Needs ~0.1 ARC (Gas)`);
        console.log(`   SELLER:   ${seller.address} -> Needs ~10.1 ARC (10 Stake + Gas)`);
        console.log(`   VERIFIER: ${verifier.address} -> Needs ~20.1 ARC (20 Stake + Gas)`);

        await waitManual("Fund the agents as listed above. The Buyer needs 0 stake, while Seller needs 10 and Verifier needs 20.");

        // --- PHASE 1.5: REGISTRATION ---
        console.log("\n🛡️ PHASE 1.5: ON-CHAIN REGISTRATION...");
        const zero32 = "0x" + "0".repeat(64);
        
        console.log(">> Registering roles with mandatory stakes...");
        await Promise.all([
            axios.post(`${HUB_URL}/execute/register`, {
                agentName: sName, agentSecret: seller.agentSecret,
                params: { asSeller: true, asVerifier: false, capHash: zero32, pubKey: zero32, amount: "10" }
            }),
            axios.post(`${HUB_URL}/execute/register`, {
                agentName: vName, agentSecret: verifier.agentSecret,
                params: { asSeller: false, asVerifier: true, capHash: zero32, pubKey: zero32, amount: "20" }
            }),
            axios.post(`${HUB_URL}/execute/register`, {
                agentName: bName, agentSecret: buyer.agentSecret,
                params: { asSeller: false, asVerifier: false, capHash: zero32, pubKey: zero32, amount: "0" }
            })
        ]);
        console.log("✅ Roles Registered On-Chain.");

        // --- PHASE 2: TASK REQUISITION ---
        console.log("\n📝 PHASE 2: TASK REQUISITION (ESCROW)...");
        const taskHash = "0x" + "1".repeat(64);
        
        const taskResp = await axios.post(`${HUB_URL}/execute/createOpenTask`, {
            agentName: bName, agentSecret: buyer.agentSecret,
            params: {
                jobDeadline: Math.floor(Date.now() / 1000) + 3600,
                bidDeadline: Math.floor(Date.now() / 1000) + 1800,
                verifierDeadline: Math.floor(Date.now() / 1000) + 2700,
                taskHash,
                verifiers: [verifier.address],
                quorumM: 1,
                isNano: true
            }
        });
        console.log(`✅ On-Chain Task Created: ${taskResp.data.txId}`);
        const taskId = "1"; // Simplified

        // --- PHASE 3: BIDDING & SELECTION ---
        console.log("\n🤝 PHASE 3: BIDDING & SELECTION...");
        await axios.post(`${HUB_URL}/execute/placeBid`, {
            agentName: sName, agentSecret: seller.agentSecret,
            params: { taskId, price: "5000000000000000", eta: 3600, meta: zero32 }
        });

        await axios.post(`${HUB_URL}/execute/selectBid`, {
            agentName: bName, agentSecret: buyer.agentSecret,
            params: { taskId, bidIndex: 0 }
        });
        console.log(`✅ Task Matched & Locked.`);

        // --- PHASE 4: VERIFICATION ---
        console.log("\n🕵️ PHASE 4: VERIFICATION...");
        await axios.post(`${HUB_URL}/execute/submitResult`, {
            agentName: sName, agentSecret: seller.agentSecret,
            params: { taskId, hash: "0x" + "2".repeat(64), uri: "ipfs://work" }
        });

        await axios.post(`${HUB_URL}/execute/approveTask`, {
            agentName: vName, agentSecret: verifier.agentSecret,
            params: { taskId }
        });
        console.log(`✅ QUALITY CERTIFIED.`);

        // --- PHASE 5: SETTLEMENT ---
        console.log("\n⚡ PHASE 5: HIGH-VELOCITY P2P SETTLEMENT...");
        await axios.post(`${HUB_URL}/execute/finalizeTask`, {
            agentName: bName, agentSecret: buyer.agentSecret,
            params: { taskId }
        });

        const payout = await axios.post(`${HUB_URL}/payout/nano`, {
            adminSecret: ADMIN_SECRET, amount: "0.005", recipient: seller.address
        });
        
        console.log(`\n🎉 SIMULATION SUCCESS!`);
        console.log(`   Transaction: ${payout.data.transaction}`);
        rl.close();

    } catch (e) {
        console.error(`\n❌ SIMULATION CRASHED:`, e.response?.data || e.message);
        rl.close();
    }
}

run();
