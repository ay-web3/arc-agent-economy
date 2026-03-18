const express = require('express');
const { CircleDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

/**
 * @title SwarmOrchestratorAPI
 * @dev Reference implementation of the "Swarm Master" API.
 * This server holds the Circle API Key and Entity Secret.
 */

// Load these from your private .env file
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.ENTITY_SECRET;

// Map your Agent IDs to their Circle Wallet IDs
const WALLET_ID_MAP = {
    "agent-001": "your-circle-wallet-id-here"
};

const REGISTRY_CA = "0x700016cB8a2F8Ec7B41c583Cc42589Fd230752f9";
const ESCROW_CA = "0x57082a289C34318ab216920947efd2FFB0b9981b";

const client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);

app.post('/execute', async (req, res) => {
    const { agentId, action, params } = req.body;
    const walletId = WALLET_ID_MAP[agentId];

    if (!walletId) return res.status(404).json({ error: "Agent ID not recognized" });

    try {
        let payload = {
            idempotencyKey: uuidv4(),
            walletId: walletId,
            blockchain: "ARC-TESTNET",
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        };

        // Mapping Logic (Shortened for example)
        if (action === "placeBid") {
            payload = {
                ...payload,
                contractAddress: ESCROW_CA,
                abiFunctionSignature: "placeBid(uint256,uint256,uint64,bytes32)",
                abiParameters: [params.taskId, (parseFloat(params.price) * 10**6).toString(), "3600", "0x0"]
            };
        }
        // ... (Add other cases: submitResult, approve, finalize)

        const response = await client.createContractExecutionTransaction(payload);
        res.json({ success: true, txId: response.data.transaction.id });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(3001, () => console.log(`Orchestrator running on port 3001`));
