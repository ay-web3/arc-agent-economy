require('dotenv').config();
const express = require('express');
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
const MASTER_WALLET_ID = process.env.MASTER_WALLET_ID;
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
const agentSchema = new mongoose.Schema({
    agentName: { type: String, required: true, unique: true },
    wallets: [{
        walletId: { type: String, required: true },
        address: { type: String, required: true },
        onboardedAt: { type: Date, default: Date.now }
    }],
    walletId: String, 
    address: String,  
    secretHash: { type: String, required: true },
    arcIdentityId: String,
    onboardedAt: { type: Date, default: Date.now }
});

let Agent;
try { Agent = mongoose.model('Agent'); } catch (e) { Agent = mongoose.model('Agent', agentSchema); }

// --- HELPERS ---

const hashSecret = (secret) => crypto.createHash('sha256').update(secret).digest('hex');

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
        if (hashSecret(agentSecret) !== agent.secretHash) return res.status(403).json({ error: "Invalid secret" });

        req.agent = agent;
        const w = agent.wallets && agent.wallets.length > 0 ? agent.wallets[agent.wallets.length - 1] : agent;
        if (!w.walletId) return res.status(404).json({ error: "Wallet not found" });
        req.walletId = w.walletId;
        next();
    } catch (e) { res.status(500).json({ error: e.message }); }
};

const sendTx = async (walletId, contractAddress, functionSig, args, value = "0", sponsored = false) => {
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
    
    // Circle ARC API expects atomic units (18 decimals) for contract execution value.
    if (value !== "0") {
        payload.amount = ethers.parseUnits(value, 18).toString();
    }
    
    if (sponsored) {
        payload.userFeeConfig = { type: "sponsorship" };
    }

    const response = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', payload, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    });
    return response.data.data;
};

const sendUSDC = async (toAddress, amount = "0.02") => {
    const ciphertext = await getCiphertext();
    const payload = {
        idempotencyKey: uuidv4(),
        entitySecretCiphertext: ciphertext,
        walletId: MASTER_WALLET_ID,
        blockchain: "ARC-TESTNET",
        amounts: [amount], // Use human-readable string directly for native transfer
        destinationAddress: toAddress,
        feeLevel: "MEDIUM"
    };
    
    const response = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/transfer', payload, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    });
    return response.data.data;
};

const SIM_PREFIX = "Sim_Internal_Ayo_";
const isSimAgent = (name) => name && name.startsWith(SIM_PREFIX);

// --- ROUTES ---

app.get('/', (req, res) => res.json({ message: "Arc Argent V1-PRO Secure is LIVE", network: "ARC Testnet" }));
app.get('/health', (req, res) => res.json({ status: "healthy" }));

app.post('/onboard', async (req, res) => {
    const { agentName, metadataURI } = req.body;
    if (!agentName) return res.status(400).json({ error: "agentName is required" });

    try {
        let agent = await Agent.findOne({ agentName });
        if (agent && agent.wallets && agent.wallets.length >= 5) return res.status(403).json({ error: "Limit reached" });

        const rawSecret = crypto.randomBytes(32).toString('hex');
        const ciphertext = await getCiphertext();
        const walletRes = await axios.post('https://api.circle.com/v1/w3s/developer/wallets', 
        {
            idempotencyKey: uuidv4(),
            accountType: "EOA",
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId: WALLET_SET_ID,
            entitySecretCiphertext: ciphertext
        }, { headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } });

        const newWallet = walletRes.data.data.wallets[0];
        
        if (MASTER_WALLET_ID) {
            try {
                // INTERNAL SIM: Fund with 5.0 USDC
                const amt = isSimAgent(agentName) ? "5.0" : "0.02";
                console.log(`[ONBOARD] Airdropping ${amt} USDC to ${newWallet.address}`);
                const fundTx = await sendUSDC(newWallet.address, amt);
                console.log(`[ONBOARD] Funding TX ID: ${fundTx.id}`);
                await new Promise(r => setTimeout(r, 15000));
            } catch (e) { console.error("[FUNDING ERROR]", e.message); }
        }

        let identityTxId = null;
        try {
            const idTx = await sendTx(newWallet.id, IDENTITY_REGISTRY, "register(string)", [metadataURI || "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei"], "0", true);
            identityTxId = idTx.id;
        } catch (e) { console.error("[IDENTITY ERROR]", e.message); }

        if (agent) {
            if (!agent.wallets) agent.wallets = [];
            agent.wallets.push({ walletId: newWallet.id, address: newWallet.address });
            await agent.save();
        } else {
            agent = new Agent({
                agentName,
                wallets: [{ walletId: newWallet.id, address: newWallet.address }],
                secretHash: hashSecret(rawSecret)
            });
            await agent.save();
        }

        res.json({ success: true, agentId: agentName, agentSecret: rawSecret, address: newWallet.address, identityTxId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/register', validateAgent, async (req, res) => {
    try {
        const { asSeller, asVerifier, capHash, pubKey, stake } = req.body;
        const finalStake = isSimAgent(req.agent.agentName) ? "0.01" : (stake || "0");
        const data = await sendTx(req.walletId, REGISTRY_CA, "register(bool,bool,bytes32,bytes32)", [asSeller, asVerifier, capHash, pubKey], finalStake);
        res.json({ success: true, txId: data.id });
    } catch (e) { 
        const msg = e.response ? JSON.stringify(e.response.data) : e.message;
        res.status(500).json({ error: msg }); 
    }
});

app.post('/execute/createOpenTask', validateAgent, async (req, res) => {
    try {
        const { jobDeadline, bidDeadline, verifierDeadline, taskHash, verifiers, quorumM, amount } = req.body;
        const finalAmt = isSimAgent(req.agent.agentName) ? "1.1" : amount;
        const data = await sendTx(req.walletId, ESCROW_CA, "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8)", [jobDeadline.toString(), bidDeadline.toString(), verifierDeadline.toString(), taskHash, verifiers, quorumM.toString()], finalAmt);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/placeBid', validateAgent, async (req, res) => {
    try {
        const { taskId, price, eta, meta } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "placeBid(uint256,uint256,uint64,bytes32)", [taskId.toString(), price, (eta || 3600).toString(), meta || ethers.ZeroHash]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/escrow/counter', async (req, res) => {
    try {
        const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
        const c = new ethers.Contract(ESCROW_CA, ["function taskCounter() view returns (uint256)"], p);
        const count = await c.taskCounter();
        res.json({ count: Number(count) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/registry/profile/:address', async (req, res) => {
    try {
        const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
        const c = new ethers.Contract(REGISTRY_CA, ["function availableStake(address) view returns (uint256)"], p);
        const bal = await c.availableStake(req.params.address);
        res.json({ availableStake: ethers.formatUnits(bal, 18) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
async function start() {
    await mongoose.connect(MONGODB_URI);
    app.listen(PORT, "0.0.0.0", () => console.log(`Master alive on ${PORT}`));
}
start().catch(err => console.error(err));
