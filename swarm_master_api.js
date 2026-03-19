require('dotenv').config();
const express = require('express');
const { CircleDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const forge = require('node-forge');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

// --- SECURE CONFIGURATION ---
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
const REGISTRY_CA = process.env.REGISTRY_CA || "0x67471b9cca5be9831c3d4b9d7f99b17dcea9852b";
const ESCROW_CA = process.env.ESCROW_CA || "0x57082a289C34318ab216920947efd2FFB0b9981b";
const MASTER_API_TOKEN = process.env.MASTER_API_TOKEN;

if (!API_KEY || !ENTITY_SECRET || !WALLET_SET_ID) {
    console.error("FATAL: Missing CIRCLE_API_KEY, ENTITY_SECRET, or WALLET_SET_ID");
    process.exit(1);
}

// Map Saske's local Agent IDs to Circle Wallet IDs
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

const auth = (req, res, next) => {
    if (MASTER_API_TOKEN && req.headers['authorization'] !== `Bearer ${MASTER_API_TOKEN}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
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

// --- AGENT REGISTRY FUNCTIONS ---

app.post('/execute/register', auth, async (req, res) => {
    const { agentId, asSeller, asVerifier, capHash, pubKey, stake } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, REGISTRY_CA, "register(bool,bool,bytes32,bytes32)", 
            [asSeller, asVerifier, capHash, pubKey], stake || "0");
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/updateProfile', auth, async (req, res) => {
    const { agentId, capHash, pubKey, active } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, REGISTRY_CA, "updateProfile(bytes32,bytes32,bool)", [capHash, pubKey, active]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/topUpStake', auth, async (req, res) => {
    const { agentId, amount } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, REGISTRY_CA, "topUpStake()", [], amount);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/request', auth, async (req, res) => {
    const { agentId, amount } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, REGISTRY_CA, "requestWithdraw(uint256)", [ethers.parseEther(amount).toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/withdraw/complete', auth, async (req, res) => {
    const { agentId } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, REGISTRY_CA, "completeWithdraw()", []);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TASK ESCROW FUNCTIONS (BUYER) ---

app.post('/execute/createOpenTask', auth, async (req, res) => {
    const { agentId, jobDeadline, bidDeadline, taskHash, verifiers, quorumM, amount } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, ESCROW_CA, "createOpenTask(uint64,uint64,bytes32,address[],uint8)", 
            [jobDeadline.toString(), bidDeadline.toString(), taskHash, verifiers, quorumM.toString()], amount);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/selectBid', auth, async (req, res) => {
    const { agentId, taskId, bidIndex } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, ESCROW_CA, "selectBid(uint256,uint256)", [taskId.toString(), bidIndex.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TASK ESCROW FUNCTIONS (SELLER) ---

app.post('/execute/placeBid', auth, async (req, res) => {
    const { agentId, taskId, price, eta, meta } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, ESCROW_CA, "placeBid(uint256,uint256,uint64,bytes32)", 
            [taskId.toString(), (parseFloat(price) * 10**18).toString(), (eta || 3600).toString(), meta || ethers.ZeroHash]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/submitResult', auth, async (req, res) => {
    const { agentId, taskId, resultHash, resultURI } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, ESCROW_CA, "submitResult(uint256,bytes32,string)", [taskId.toString(), resultHash, resultURI]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TASK ESCROW FUNCTIONS (VERIFIER) ---

app.post('/execute/approve', auth, async (req, res) => {
    const { agentId, taskId } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, ESCROW_CA, "approve(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- KEEPER / AUTO ---

app.post('/execute/finalize', auth, async (req, res) => {
    const { agentId, taskId } = req.body;
    const walletId = AGENT_DATABASE[agentId];
    try {
        const data = await sendTx(walletId, ESCROW_CA, "finalize(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Swarm Master (Comprehensive V2) on port ${PORT}`));
