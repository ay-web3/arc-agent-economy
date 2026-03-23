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

/**
 * @dev Random Verifier Selection Logic (Sybil Resistance)
 * Picks N active verifiers from the MongoDB registry who have stake.
 */
async function getRandomVerifiers(count = 3, excludeAddr = null) {
    try {
        const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
        const registry = new ethers.Contract(REGISTRY_CA, ["function isVerifier(address) view returns (bool)"], p);
        
        // 1. Get all agents from DB
        const allAgents = await Agent.find({});
        const activeVerifiers = [];

        for (const agent of allAgents) {
            const addr = agent.wallets[agent.wallets.length - 1].address;
            if (addr === excludeAddr) continue;

            // 2. Check on-chain status
            const isV = await registry.isVerifier(addr);
            if (isV) activeVerifiers.push(addr);
            if (activeVerifiers.length >= 10) break; // Optimization
        }

        // 3. Shuffle and pick N
        const shuffled = activeVerifiers.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    } catch (e) {
        console.error("[RANDOM_VERIFIER_ERROR]", e.message);
        return [];
    }
}

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
        const w = (agent.wallets && agent.wallets.length > 0) ? agent.wallets[agent.wallets.length - 1] : agent;
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
    if (value !== "0") {
        payload.amount = value.toString();
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
        amounts: [amount.toString()], 
        destinationAddress: toAddress,
        feeLevel: "MEDIUM"
    };
    const response = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/transfer', payload, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    });
    return response.data.data;
};

// --- ROUTES ---

app.get('/', (req, res) => res.json({ 
    message: "Arc Argent V1-PRO Secure Orchestrator is LIVE", 
    network: "ARC Testnet (5042002)",
    status: "Stable Production - Full Lifecycle Enabled"
}));

app.get('/health', async (req, res) => {
    res.json({ status: "healthy", version: "1.0.1_full_restore" });
});

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
                await sendUSDC(newWallet.address, "0.02");
                await new Promise(r => setTimeout(r, 12000));
            } catch (e) { console.error("[FUNDING]", e.message); }
        }

        let identityTxId = null;
        try {
            const idTx = await sendTx(newWallet.id, IDENTITY_REGISTRY, "register(string)", [metadataURI || "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei"], "0", true);
            identityTxId = idTx.id;
        } catch (e) { console.error("[IDENTITY]", e.message); }

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

// --- REGISTRY ENDPOINTS ---

app.post('/admin/restoreStakes', async (req, res) => {
    try {
        const { secret } = req.body;
        // Simple internal check using hashed entity secret or similar (not for prod, just for this restoration)
        if (secret !== ENTITY_SECRET) return res.status(401).json({ error: "Unauthorized" });

        const data = await sendTx(MASTER_WALLET_ID, REGISTRY_CA, "setMinStakes(uint256,uint256)", [
            ethers.parseUnits("50.0", 18).toString(),
            ethers.parseUnits("30.0", 18).toString()
        ]);
        res.json({ success: true, txId: data.id, message: "Restoring stakes: Seller 50.0, Verifier 30.0 USDC" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

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

// --- ESCROW ENDPOINTS ---

app.post('/execute/createOpenTask', validateAgent, async (req, res) => {
    try {
        let { jobDeadline, bidDeadline, verifierDeadline, taskHash, verifiers, quorumM, amount, randomVerifiers = 0 } = req.body;
        
        // --- RANDOM SELECTION OPT-IN ---
        if (randomVerifiers > 0) {
            console.log(`[TASK] Selecting ${randomVerifiers} random verifiers for ${req.agent.agentName}`);
            const randomList = await getRandomVerifiers(randomVerifiers, req.agent.wallets[req.agent.wallets.length - 1].address);
            verifiers = randomList;
            quorumM = Math.ceil(randomList.length * 0.6); // Default 60% quorum
        }

        if (!verifiers || verifiers.length === 0) return res.status(400).json({ error: "No verifiers assigned. Please provide a 'verifiers' list or 'randomVerifiers' count." });

        const data = await sendTx(req.walletId, ESCROW_CA, "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8)", [jobDeadline.toString(), bidDeadline.toString(), verifierDeadline.toString(), taskHash, verifiers, quorumM.toString()], amount);
        res.json({ success: true, txId: data.id, verifiersAssigned: verifiers });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/execute/placeBid', validateAgent, async (req, res) => {
    try {
        const { taskId, price, eta, meta } = req.body;
        const atomicPrice = ethers.parseUnits(price, 18).toString();
        const data = await sendTx(req.walletId, ESCROW_CA, "placeBid(uint256,uint256,uint64,bytes32)", [taskId.toString(), atomicPrice, (eta || 3600).toString(), meta || ethers.ZeroHash]);
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

app.post('/execute/submitResult', validateAgent, async (req, res) => {
    try {
        const { taskId, resultHash, resultURI } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "submitResult(uint256,bytes32,string)", [taskId.toString(), resultHash, resultURI]);
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

app.post('/execute/finalize', validateAgent, async (req, res) => {
    try {
        const { taskId } = req.body;
        const data = await sendTx(req.walletId, ESCROW_CA, "finalize(uint256)", [taskId.toString()]);
        res.json({ success: true, txId: data.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- DATA READ ENDPOINTS ---

app.get('/escrow/counter', async (req, res) => {
    try {
        const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
        const c = new ethers.Contract(ESCROW_CA, ["function taskCounter() view returns (uint256)"], p);
        const count = await c.taskCounter();
        res.json({ count: Number(count) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/escrow/task/:id', async (req, res) => {
    try {
        const p = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
        const c = new ethers.Contract(ESCROW_CA, ["function tasks(uint256) view returns (address, address, uint256, uint256, uint256, uint64, uint64, uint64, uint64, bytes32, bytes32, string, uint8, uint8, uint8)"], p);
        const t = await c.tasks(req.params.id);
        res.json({
            buyer: t[0], seller: t[1], price: ethers.formatUnits(t[2], 18),
            verifierPool: ethers.formatUnits(t[3], 18), sellerBudget: ethers.formatUnits(t[4], 18),
            state: Number(t[12])
        });
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
    app.listen(PORT, "0.0.0.0", () => console.log(`Swarm Master live on ${PORT}`));
}
start().catch(err => console.error(err));
