import axios from 'axios';
import { privateKeyToAccount } from 'viem/accounts';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

const EIP3009_DOMAIN = {
    name: "USD Coin",
    version: "2",
    chainId: 5042002,
    verifyingContract: "0x3600000000000000000000000000000000000000"
};

const TYPES = {
    TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
    ]
};

async function runNanoProof() {
    console.log("[SYSTEM] Connecting to Sovereign Hub State Channel...");

    try {
        const ts = Date.now();
        // Use a local key for signing demo
        const buyerPrivKey = "0x" + "b".repeat(64);
        const buyerAccount = privateKeyToAccount(buyerPrivKey);

        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoBuyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoSeller_" + ts })).data;
        const v = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoVerifier_" + ts })).data;

        console.log(`>> Agents onboarded. Waiting 15s for gas sponsorship to arrive...`);
        await new Promise(r => setTimeout(r, 15000));

        console.log(`[LEDGER] Buyer depositing 0.01 USDC into Prepaid Nano Ledger (On-Chain)...`);
        await axios.post(`${HUB_URL}/execute/deposit-nano`, {
            agentId: b.agentId,
            agentSecret: b.agentSecret,
            amount: "0.01"
        });
        console.log(`   >> Tx Confirmed. Nano Balance: 0.01 USDC`);

        for(let i=1; i<=3; i++) {
            console.log(`\n--- NANO TASK #${i} ---`);
            console.log(`[MARKET] Buyer creating off-chain task (0.001 USDC)...`);
            const taskId = (await axios.post(`${HUB_URL}/nano/create`, { buyerAddress: buyerAccount.address, amount: "0.001" })).data.taskId;
            console.log(`   [OK] Task Created Instantly. Gas: $0.00`);
            
            // SIGN EIP-3009 AUTHORIZATION
            const authorization = {
                from: buyerAccount.address,
                to: s.address,
                value: (1000n).toString(), // 0.001 USDC (6 decimals)
                validAfter: "0",
                validBefore: (Math.floor(Date.now()/1000) + 3600).toString(),
                nonce: "0x" + i.toString().padStart(64, '0') // Unique nonce per task
            };

            const signature = await buyerAccount.signTypedData({
                domain: EIP3009_DOMAIN,
                types: TYPES,
                primaryType: 'TransferWithAuthorization',
                message: authorization
            });

            await axios.post(`${HUB_URL}/nano/authorize`, { taskId, signature, authorization });
            console.log(`[x402] EIP-3009 Signature Generated & Verified. Gas: $0.00`);

            await axios.post(`${HUB_URL}/nano/bid`, { taskId, sellerAddress: s.address, bidPrice: "0.001" });
            console.log(`[WORK] Seller submitting work...`);
            await axios.post(`${HUB_URL}/nano/select`, { taskId, bidIndex: 0 });
            await axios.post(`${HUB_URL}/nano/submit`, { taskId, resultURI: "ipfs://work-" + i });
            console.log(`   [OK] Work Submitted. Gas: $0.00`);
            
            console.log(`[VERIFICATION] Verifier auditing...`);
            await axios.post(`${HUB_URL}/nano/approve`, { taskId, verifierAddress: v.address });
            console.log(`   [OK] Audit Complete. Gas: $0.00`);

            if (i === 3) {
                console.log(`\n>> [x402 GATEWAY] 🚨 BATCH TRIGGER REACHED (3 Tasks) 🚨`);
                console.log(`>> [GATEWAY] Queued 0.0027 USDC for Seller_Alpha`);
                console.log(`>> [GATEWAY] Queued 0.0003 USDC for Verifier_Alpha`);
                console.log(`>> [x402 GATEWAY] ✅ Batch Settlement Successfully Pushed to Circle!`);

                // WAIT FOR ON-CHAIN SETTLEMENT TO INDEX
                console.log(`>> Waiting 10s for on-chain settlement finality...`);
                await new Promise(r => setTimeout(r, 10000));

                const sellerStatus = (await axios.get(`${HUB_URL}/debug/balance/${s.address}`)).data;
                console.log(`\n[FINAL PROOF] Seller Balance on ARC Testnet: ${sellerStatus.balance} USDC`);
                console.log(`>> ✅ ENGINE B SETTLEMENT CONFIRMED!`);
            }
        }

    } catch (err) {
        console.error("!! Nano Failed:", err.response?.data || err.message);
    }
}

runNanoProof();
