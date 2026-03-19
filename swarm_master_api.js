require('dotenv').config();
const express = require('express');
const { CircleDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const forge = require('node-forge');
const { ethers } = require('ethers');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// --- SECURE CONFIGURATION ---
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
const REGISTRY_CA = process.env.REGISTRY_CA || "0xd3d7bf4d3c78ff94ba5e03fe11659799a42134d3";
const ESCROW_CA = process.env.ESCROW_CA || "0xf208658ef1117d0dbce462e1b9961a9bd3d61e0f";
const MASTER_API_TOKEN = process.env.MASTER_API_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

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
    onboardedAt: { type: Date, default: Date.now }
});

const Agent = mongoose.model('Agent', agentSchema);

// --- HELPERS ---

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

const auth = (req, res, next) => {
    if (MASTER_API_TOKEN && req.headers['authorization'] !== `Bearer ${MASTER_API_TOKEN}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};

const getWalletId = async (agentName) => {
    const agent = await Agent.findOne({ agentName });
    if (!agent) throw new Error(`Agent '${agentName}' not found in database.`);
    return agent.walletId;
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

// --- CORE SYSTEM ENDPOINTS ---

app.get('/agents', auth, async (req, res) => {
    try {
        const agents = await Agent.find({}, 'agentName address onboardedAt');
        res.json({ success: true, agents });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/onboard', auth, async (req, res) => {
    const { agentName } = req.body;
    if (!agentName) return res.status(400).json({ error: "agentName is required" });

    try {
        // Check if already exists
        let agent = await Agent.findOne({ agentName });
        if (agent) {
            return res.json({ success: true, message: "Agent already onboarded", address: agent.address });
        }

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
        
        // Save to MongoDB
        agent = new Agent({
            agentName,
            walletId: newWallet.id,
            address: newWallet.address
        });
        await agent.save();

        res.json({ success: true, agentId: agentName, walletId: newWallet.id, address: newWallet.address });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- AGENT REGISTRY ENDPOINTS ---

app.post('/execute/register', auth, async (req, res) => {
    try {
        const { agentId, asSeller, asVerifier, capHash, pubKey, stake } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "register(bool,bool,bytes32,bytes32)", 
            [asSeller, asVerifier, capHash, pubKey], stake || "0");
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/updateProfile', auth, async (req, res) => {
    try {
        const { agentId, capHash, pubKey, active } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "updateProfile(bytes32,bytes32,bool)", [capHash, pubKey, active]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/setRoles', auth, async (req, res) => {
    try {
        const { agentId, wantSeller, wantVerifier } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "setRoles(bool,bool)", [wantSeller, wantVerifier]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/topUpStake', auth, async (req, res) => {
    try {
        const { agentId, amount } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "topUpStake()", [], amount);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/request', auth, async (req, res) => {
    try {
        const { agentId, amount } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "requestWithdraw(uint256)", [ethers.parseUnits(amount, 18).toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/cancel', auth, async (req, res) => {
    try {
        const { agentId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "cancelWithdraw()", []);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/complete', auth, async (req, res) => {
    try {
        const { agentId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, REGISTRY_CA, "completeWithdraw()", []);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TASK ESCROW ENDPOINTS ---

app.post('/execute/createOpenTask', auth, async (req, res) => {
    try {
        const { agentId, jobDeadline, bidDeadline, verifierDeadline, taskHash, verifiers, quorumM, amount } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8)", 
            [jobDeadline.toString(), bidDeadline.toString(), verifierDeadline.toString(), taskHash, verifiers, quorumM.toString()], amount);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/reject', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "reject(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/verifierTimeoutRefund', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "verifierTimeoutRefund(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/placeBid', auth, async (req, res) => {
    try {
        const { agentId, taskId, price, eta, meta } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "placeBid(uint256,uint256,uint64,bytes32)", 
            [taskId.toString(), ethers.parseUnits(price, 18).toString(), (eta || 3600).toString(), meta || ethers.ZeroHash]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/selectBid', auth, async (req, res) => {
    try {
        const { agentId, taskId, bidIndex } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "selectBid(uint256,uint256)", [taskId.toString(), bidIndex.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/finalizeAuction', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "finalizeAuction(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/cancelIfNoBids', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "cancelIfNoBids(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/submitResult', auth, async (req, res) => {
    try {
        const { agentId, taskId, resultHash, resultURI } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "submitResult(uint256,bytes32,string)", [taskId.toString(), resultHash, resultURI]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/timeoutRefund', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "timeoutRefund(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/approve', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "approve(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/finalize', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "finalize(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/openDispute', auth, async (req, res) => {
    try {
        const { agentId, taskId } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "openDispute(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- GOVERNANCE ENDPOINTS ---

app.post('/execute/resolveDispute', auth, async (req, res) => {
    try {
        const { agentId, taskId, ruling, buyerBps } = req.body;
        const walletId = await getWalletId(agentId);
        const data = await sendTx(walletId, ESCROW_CA, "resolveDispute(uint256,uint8,uint16)", [taskId.toString(), ruling.toString(), buyerBps.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Swarm Master (MongoDB Edition) on port ${PORT}`));
