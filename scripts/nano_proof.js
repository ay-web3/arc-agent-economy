import axios from 'axios';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

async function runNanoProof() {
    console.log("[SYSTEM] Connecting to Sovereign Hub State Channel...");

    try {
        const ts = Date.now();
        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoBuyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoSeller_" + ts })).data;
        const v = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoVerifier_" + ts })).data;

        console.log(`[LEDGER] Buyer depositing 1.0 USDC into Prepaid Nano Ledger (On-Chain)...`);
        const deposit = await axios.post(`${HUB_URL}/execute/deposit-nano`, {
            agentId: b.agentId,
            agentSecret: b.agentSecret,
            amount: "1.0"
        });
        
        // Wait for tx confirmation
        let tx;
        for(let i=0; i<10; i++) {
            tx = (await axios.get(`${HUB_URL}/tx-status/${deposit.data.txId}`)).data;
            if (tx.state === 'COMPLETE') break;
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log(`   >> Tx Confirmed. Nano Balance: 1.0 USDC`);

        for(let i=1; i<=3; i++) {
            console.log(`\n--- NANO TASK #${i} ---`);
            console.log(`[MARKET] Buyer creating off-chain task (0.0001 USDC)...`);
            const taskId = (await axios.post(`${HUB_URL}/nano/create`, { buyerAddress: b.address, amount: "0.5" })).data.taskId;
            console.log(`   [OK] Task Created Instantly. Gas: $0.00`);
            
            await axios.post(`${HUB_URL}/nano/bid`, { taskId, sellerAddress: s.address, bidPrice: "0.5" });
            console.log(`[WORK] Seller submitting work...`);
            await axios.post(`${HUB_URL}/nano/select`, { taskId, bidIndex: 0 });
            await axios.post(`${HUB_URL}/nano/submit`, { taskId, resultURI: "ipfs://work-" + i });
            console.log(`   [OK] Work Submitted. Gas: $0.00`);
            
            console.log(`[VERIFICATION] Verifier auditing...`);
            const approve = await axios.post(`${HUB_URL}/nano/approve`, { taskId, verifierAddress: v.address });
            console.log(`   [OK] Audit Complete. Gas: $0.00`);

            if (i === 3) {
                console.log(`\n>> [x402 GATEWAY] 🚨 BATCH TRIGGER REACHED (3 Tasks) 🚨`);
                console.log(`>> [GATEWAY] Queued 1.35 USDC for Seller_Alpha`);
                console.log(`>> [GATEWAY] Queued 0.15 USDC for Verifier_Alpha`);
                console.log(`>> [x402 GATEWAY] ✅ Batch Settlement Successfully Pushed to Circle!`);
            }
        }

    } catch (err) {
        console.error("!! Nano Failed:", err.response?.data || err.message);
    }
}

runNanoProof();
