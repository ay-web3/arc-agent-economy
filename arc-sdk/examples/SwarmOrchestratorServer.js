import express from 'express';
import { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

/**
 * @title SwarmOrchestratorAPI (90/4/4/2 Edition)
 * @dev Reconfigured for Cloud Run and hardened with 18-decimal scaling.
 */

const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
const GATEWAY_ADDR = process.env.GATEWAY_ADDR || "0x0000000000000000000000000000000000000000";

const REGISTRY_CA = "0xB2332698FF627c8CD9298Df4dF2002C4c5562862";
const ESCROW_CA = "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";

const client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);
const gateway = new GatewayClient({ 
    gatewayAddress: GATEWAY_ADDR, 
    blockchain: "ARC-TESTNET" 
});

const AGENT_DATABASE = {}; // In production, use persistent storage

app.get('/health', (req, res) => res.json({ status: "READY", network: "ARC-TESTNET" }));

app.post('/onboard', async (req, res) => {
    const { agentName } = req.body;
    try {
        const response = await client.createWallets({
            idempotencyKey: uuidv4(),
            accountType: "EOA",
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId: WALLET_SET_ID
        });
        const newWallet = response.data.wallets[0];
        AGENT_DATABASE[agentName] = newWallet.id;
        res.json({ success: true, agentId: agentName, address: newWallet.address });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/execute', async (req, res) => {
    const { agentId, action, params } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    if (!walletId) return res.status(404).json({ error: "Agent ID not onboarded" });

    try {
        let payload = {
            idempotencyKey: uuidv4(),
            walletId: walletId,
            blockchain: "ARC-TESTNET",
            contractAddress: "",
            abiFunctionSignature: "",
            abiParameters: [],
            amount: params.amount || "0",
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        };

        switch(action) {
            case "register":
                payload.contractAddress = REGISTRY_CA;
                payload.abiFunctionSignature = "register(bool,bool,bytes32,bytes32)";
                payload.abiParameters = [params.asSeller, params.asVerifier, params.capHash, params.pubKey];
                payload.amount = params.stake;
                break;
            case "placeBid":
                payload.contractAddress = ESCROW_CA;
                payload.abiFunctionSignature = "placeBid(uint256,uint256,uint64,bytes32)";
                // SYNC: Updated to 10**18 for 90/4/4/2 economy
                payload.abiParameters = [params.taskId, (parseFloat(params.price) * 10**18).toString(), params.eta.toString(), params.meta];
                break;
            case "createOpenTask":
                payload.contractAddress = ESCROW_CA;
                payload.abiFunctionSignature = "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8,bool)";
                payload.abiParameters = [params.jobDeadline, params.bidDeadline, params.verifierDeadline, params.taskHash, params.verifiers, params.quorumM, params.isNano];
                break;
            case "finalizeTask":
                payload.contractAddress = ESCROW_CA;
                payload.abiFunctionSignature = "finalize(uint256)";
                payload.abiParameters = [params.taskId];
                break;
            // ... add other cases as needed
        }

        const response = await client.createContractExecutionTransaction(payload);
        res.json({ success: true, txId: response.data.transaction.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/payout/nano', async (req, res) => {
    const { recipient, amount } = req.body;
    try {
        const response = await gateway.pay({
            amount: amount,
            recipient: recipient,
            currency: "USDC"
        });
        res.json({ success: true, batchId: response.batchId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DEPLOYED] Swarm Orchestrator active on 0.0.0.0:${PORT}`);
});
