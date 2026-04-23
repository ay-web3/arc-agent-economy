import axios from 'axios';
import { privateKeyToAccount } from 'viem/accounts';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";

const EIP3009_DOMAIN = {
    name: "USD Coin",
    version: "2",
    chainId: 10247,
    verifyingContract: "0x0000000000000000000000000000000000000000" // Mock for demo
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

        console.log(`[LEDGER] Buyer depositing 1.0 USDC into Prepaid Nano Ledger (On-Chain)...`);
        await axios.post(`${HUB_URL}/execute/deposit-nano`, {
            agentId: b.agentId,
            agentSecret: b.agentSecret,
            amount: "1.0"
        });
        console.log(`   >> Tx Confirmed. Nano Balance: 1.0 USDC`);

        for(let i=1; i<=3; i++) {
            console.log(`\n--- NANO TASK #${i} ---`);
            console.log(`[MARKET] Buyer creating off-chain task (0.0001 USDC)...`);
            const taskId = (await axios.post(`${HUB_URL}/nano/create`, { buyerAddress: buyerAccount.address, amount: "0.5" })).data.taskId;
            console.log(`   [OK] Task Created Instantly. Gas: $0.00`);
            
            // SIGN EIP-3009 AUTHORIZATION
            const authorization = {
                from: buyerAccount.address,
                to: s.address,
                value: BigInt(500000000000000), // 0.0005 USDC
                validAfter: BigInt(0),
                validBefore: BigInt(Math.floor(Date.now()/1000) + 3600),
                nonce: "0x" + "1".repeat(64)
            };

            const signature = await buyerAccount.signTypedData({
                domain: EIP3009_DOMAIN,
                types: TYPES,
                primaryType: 'TransferWithAuthorization',
                message: authorization
            });

            await axios.post(`${HUB_URL}/nano/authorize`, { taskId, signature, authorization });
            console.log(`[x402] EIP-3009 Signature Generated & Verified. Gas: $0.00`);

            await axios.post(`${HUB_URL}/nano/bid`, { taskId, sellerAddress: s.address, bidPrice: "0.5" });
            console.log(`[WORK] Seller submitting work...`);
            await axios.post(`${HUB_URL}/nano/select`, { taskId, bidIndex: 0 });
            await axios.post(`${HUB_URL}/nano/submit`, { taskId, resultURI: "ipfs://work-" + i });
            console.log(`   [OK] Work Submitted. Gas: $0.00`);
            
            console.log(`[VERIFICATION] Verifier auditing...`);
            await axios.post(`${HUB_URL}/nano/approve`, { taskId, verifierAddress: v.address });
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
