require('dotenv').config();
const express = require('express');
const { CircleDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const forge = require('node-forge');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- SECURE CONFIGURATION ---
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
const REGISTRY_CA = process.env.REGISTRY_CA || "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const ESCROW_CA = process.env.ESCROW_CA || "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const MONGODB_URI = process.env.MONGODB_URI;

// --- ARC GLOBAL REGISTRIES (ERC-8004) ---
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

if (!API_KEY || !ENTITY_SECRET || !WALLET_SET_ID || !MONGODB_URI) {
    console.error("FATAL: Missing CIRCLE_API_KEY, ENTITY_SECRET, WALLET_SET_ID, or MONGODB_URI");
    process.exit(1);
}

// --- DATABASE SETUP (MONGODB) ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log("[DATABASE] Connected to MongoDB Atlas"))
    .catch(err => console.error("[DATABASE] Connection error:", err));

const agentSchema = new mongoose.Schema({
    agentName: { type: String, required: true, unique: true },
    walletId: { type: String, required: true },
    address: { type: String, required: true },
    secretHash: { type: String, required: true },
    arcIdentityId: { type: String },
    onboardedAt: { type: Date, default: Date.now }
});

const Agent = mongoose.model('Agent', agentSchema);

// --- HELPERS ---

const hashSecret = (secret) => {
    return crypto.createHash('sha256').update(secret).digest('hex');
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

const validateAgent = async (req, res, next) => {
    const { agentId, agentSecret } = req.body;
    if (!agentId || !agentSecret) return res.status(401).json({ error: "Missing agentId or agentSecret" });

    try {
        const agent = await Agent.findOne({ agentName: agentId });
        if (!agent) return res.status(404).json({ error: "Agent not found" });

        if (hashSecret(agentSecret) !== agent.secretHash) {
            return res.status(403).json({ error: "Invalid agentSecret." });
        }

        req.agent = agent;
        req.walletId = agent.walletId;
        next();
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const sendTx = async (walletId, contractAddress, functionSig, args, value = "0") => {
    const ciphertext = await getCiphertext();
    const payload = {
        idempotencyKey: uuidv4(),
        entitySecretCiphertext: ciphertext,
        walletId,
        blockchain: "ARC-TESTNET",
        feeLevel: "MEDIUM",
        contractAddress,
        abiFunctionSignature: functionSig,
        abiParameters: args
    };
    if (value !== "0") payload.amount = [value];

    const response = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', payload, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    });
    return response.data.data;
};

// --- ROUTES ---

app.get('/', (req, res) => {
    res.json({ 
        message: "Arc Argent Public Orchestrator V1-PRO Secure is LIVE",
        network: "ARC Testnet",
        standards: ["ERC-8004"],
        github: "https://github.com/ay-web3/arc-agent-economy"
    });
});

app.get('/health', (req, res) => res.json({ status: "healthy" }));

app.post('/onboard', async (req, res) => {
    const { agentName, metadataURI } = req.body;
    if (!agentName) return res.status(400).json({ error: "agentName is required" });

    try {
        let agent = await Agent.findOne({ agentName });
        if (agent) return res.status(409).json({ error: "Name taken" });

        const rawSecret = crypto.randomBytes(32).toString('hex');
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
        
        const defaultURI = "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";
        const identityTx = await sendTx(newWallet.id, IDENTITY_REGISTRY, "register(string)", [metadataURI || defaultURI]);

        agent = new Agent({
            agentName,
            walletId: newWallet.id,
            address: newWallet.address,
            secretHash: hashSecret(rawSecret)
        });
        await agent.save();

        res.json({ 
            success: true, 
            agentId: agentName, 
            agentSecret: rawSecret, 
            address: newWallet.address,
            identityTxId: identityTx.id 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/finalize', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "finalize(uint256)", [taskId.toString()]);
        
        const tag = "successful_arc_argent_task";
        const feedbackHash = ethers.id(tag);
        await sendTx(req.walletId, REPUTATION_REGISTRY, 
            "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
            [req.agent.arcIdentityId || "0", "100", "0", tag, `Task #${taskId}`, "", "", feedbackHash]);

        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Registry Endpoints
app.post('/execute/register', validateAgent, async (req, res) => {
    try {
        const { asSeller, asVerifier, capHash, pubKey, stake } = req.body;
        const data = await sendTx(req.walletId, REGISTRY_CA, "register(bool,bool,bytes32,bytes32)", [asSeller, asVerifier, capHash, pubKey], stake || "0");
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/updateProfile', validateAgent, async (req, res) => {
    try {
        const { capHash, pubKey, active } = req.body;
        const data = await sendTx(req.walletId, REGISTRY_CA, "updateProfile(bytes32,bytes32,bool)", [capHash, pubKey, active]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/setRoles', validateAgent, async (req, res) => {
    try {
        const { wantSeller, wantVerifier } = req.body;
        const data = await sendTx(req.walletId, REGISTRY_CA, "setRoles(bool,bool)", [wantSeller, wantVerifier]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/topUpStake', validateAgent, async (req, res) => {
    try {
        const { amount } = req.body;
        const data = await sendTx(req.walletId, REGISTRY_CA, "topUpStake()", [], amount);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/request', validateAgent, async (req, res) => {
    try {
        const { amount } = req.body;
        const data = await sendTx(req.walletId, REGISTRY_CA, "requestWithdraw(uint256)", [ethers.parseUnits(amount, 18).toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/cancel', validateAgent, async (req, res) => {
    try {
        const data = await sendTx(req.walletId, REGISTRY_CA, "cancelWithdraw()", []);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/complete', validateAgent, async (req, res) => {
    try {
        const data = await sendTx(req.walletId, REGISTRY_CA, "completeWithdraw()", []);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Escrow Endpoints
app.post('/execute/createOpenTask', validateAgent, async (req, res) => {
    try {
        const { jobDeadline, bidDeadline, verifierDeadline, taskHash, verifiers, quorumM, amount } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8)", [jobDeadline.toString(), bidDeadline.toString(), verifierDeadline.toString(), taskHash, verifiers, quorumM.toString()], amount);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/reject', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "reject(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/verifierTimeoutRefund', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "verifierTimeoutRefund(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/placeBid', validateAgent, async (req, res) => {
    try {
        const { taskId, price, eta, meta } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "placeBid(uint256,uint256,uint64,bytes32)", [taskId.toString(), ethers.parseUnits(price, 18).toString(), (eta || 3600).toString(), meta || ethers.ZeroHash]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/selectBid', validateAgent, async (req, res) => {
    try {
        const { taskId, bidIndex } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "selectBid(uint256,uint256)", [taskId.toString(), bidIndex.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/finalizeAuction', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "finalizeAuction(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/cancelIfNoBids', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "cancelIfNoBids(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/submitResult', validateAgent, async (req, res) => {
    try {
        const { taskId, resultHash, resultURI } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "submitResult(uint256,bytes32,string)", [taskId.toString(), resultHash, resultURI]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/timeoutRefund', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "timeoutRefund(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/approve', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "approve(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/openDispute', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "openDispute(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/resolveDispute', validateAgent, async (req, res) => {
    try {
        const { taskId, ruling, buyerBps } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "resolveDispute(uint256,uint8,uint16)", [taskId.toString(), ruling.toString(), buyerBps.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/updateArcIdentity', validateAgent, async (req, res) => {
    try {
        const { tokenId } = req.body;
        req.agent.arcIdentityId = tokenId;
        await req.agent.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Swarm Master (V1-PRO Secure) on port ${PORT}`));
