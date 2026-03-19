require('dotenv').config();
const express = require('express');
const { CircleDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const forge = require('node-forge');
const app = express();
app.use(express.json());

// --- SECURE CONFIGURATION VIA ENVIRONMENT VARIABLES ---
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
const ESCROW_CA = process.env.ESCROW_CA || "0x57082a289C34318ab216920947efd2FFB0b9981b";
const MASTER_API_TOKEN = process.env.MASTER_API_TOKEN; // Optional: Simple bearer token for Saske

if (!API_KEY || !ENTITY_SECRET || !WALLET_SET_ID) {
    console.error("FATAL ERROR: Missing required environment variables (CIRCLE_API_KEY, ENTITY_SECRET, WALLET_SET_ID)");
    process.exit(1);
}

const client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);

// Persistent Agent Database (In-memory for now, use a file/DB for production)
const AGENT_DATABASE = {
    "saske-secure": "4a627807-9cab-5192-848f-9894f95ffb30",
    "buyer-secure": "1f016837-24a8-514d-8fce-e875e69abaaa"
};

async function getCiphertext() {
    const pubResponse = await axios.get('https://api.circle.com/v1/w3s/config/entity/publicKey', {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const publicKey = forge.pki.publicKeyFromPem(pubResponse.data.data.publicKey);
    const encrypted = publicKey.encrypt(forge.util.hexToBytes(ENTITY_SECRET), 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: { md: forge.md.sha256.create() }
    });
    return forge.util.encode64(encrypted);
}

// Middleware: Simple Security (If token is set)
const authenticateSaske = (req, res, next) => {
    if (MASTER_API_TOKEN && req.headers['authorization'] !== `Bearer ${MASTER_API_TOKEN}`) {
        return res.status(401).json({ error: "Unauthorized access" });
    }
    next();
};

app.post('/onboard', authenticateSaske, async (req, res) => {
    const { agentName } = req.body;
    try {
        console.log(`[ORCHESTRATOR] Auto-provisioning wallet for: ${agentName}`);
        const ciphertext = await getCiphertext();
        const response = await axios.post('https://api.circle.com/v1/w3s/developer/wallets', 
        {
            idempotencyKey: uuidv4(),
            accountType: "EOA",
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId: WALLET_SET_ID,
            entitySecretCiphertext: ciphertext
        }, { headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } });

        const newWallet = response.data.data.wallets[0];
        AGENT_DATABASE[agentName] = newWallet.id;

        console.log(`[SUCCESS] ${agentName} onboarded with wallet ${newWallet.address}`);
        res.json({ success: true, agentId: agentName, walletId: newWallet.id, address: newWallet.address });
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/execute', authenticateSaske, async (req, res) => {
    const { agentId, action, params } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    if (!walletId) return res.status(404).json({ error: "Agent ID not recognized" });

    try {
        const ciphertext = await getCiphertext();
        let payload = {
            idempotencyKey: uuidv4(),
            entitySecretCiphertext: ciphertext,
            walletId: walletId,
            blockchain: "ARC-TESTNET",
            feeLevel: "MEDIUM"
        };

        if (action === "placeBid") {
            payload = {
                ...payload,
                contractAddress: ESCROW_CA,
                abiFunctionSignature: "placeBid(uint256,uint256,uint64,bytes32)",
                abiParameters: [params.taskId, (parseFloat(params.price) * 10**6).toString(), "3600", "0x0000000000000000000000000000000000000000000000000000000000000000"]
            };
        }

        const response = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', payload, {
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
        });

        res.json({ success: true, txId: response.data.data.id });
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Swarm Master API (Secure Cloud V1) running on port ${PORT}`));
