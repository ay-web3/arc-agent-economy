import express from 'express';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

// --- THE SOVEREIGN SENTINEL (Definitive Final) ---
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// --- BOOTSTRAP INITIATION ---
bootstrap(); // Start background logic (SDK + DB)

// --- GLOBAL STATE ---
let client = null;
let gateway = null;
let uuidv4 = null;
let SDK_LOAD_ERROR = null;
let agentCollection = null;
let mongoPromise = null;

// --- DUAL-RESOLUTION FACTORY ENGINE ---
async function bootstrap() {
    try {
        const sdkModule = await import('@circle-fin/developer-controlled-wallets');
        const initClient = sdkModule.initiateDeveloperControlledWalletsClient || 
                           sdkModule.default?.initiateDeveloperControlledWalletsClient;
        
        if (typeof initClient !== 'function') {
            throw new Error(`CRITICAL: Circle SDK factory not found.`);
        }

        const gatewayModule = await import('@circle-fin/x402-batching');
        const Gateway = gatewayModule.GatewayClient || gatewayModule.default?.GatewayClient || gatewayModule.default;

        uuidv4 = () => crypto.randomUUID();

        const API_KEY = process.env.CIRCLE_API_KEY;
        const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;
        const WALLET_SET_ID = process.env.WALLET_SET_ID;
        const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || process.env.GATEWAY_ADDR || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

        if (API_KEY && ENTITY_SECRET) {
            client = initClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET });
            if (Gateway) {
                gateway = new Gateway({ gatewayAddress: GATEWAY_ADDR, blockchain: "ARC-TESTNET" });
            }
            console.log(">> [SENTINEL] Swarm Engines Operational.");
        }

        if (process.env.MONGODB_URI) {
            const mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
            mongoPromise = mongo.connect().then(() => {
                agentCollection = mongo.db().collection('agent_registry');
                console.log(">> [SENTINEL] Memory Persistence Synchronized.");
            });
        }
    } catch (e) {
        console.error(">> [FATAL] Logic Restoration Failed:", e.message);
        SDK_LOAD_ERROR = { message: e.message, stack: e.stack, time: new Date().toISOString() };
    }
}

// --- UTILS ---
async function verifyAgent(agentName, providedSecret) {
    if (mongoPromise) await mongoPromise;
    if (!agentCollection || !providedSecret) return { success: false, error: "Missing identity or validation" };
    
    const record = await agentCollection.findOne({ agentName });
    if (!record || !record.hashedSecret) return { success: false, error: "Agent unauthorized or not secured" };

    const hash = crypto.createHash('sha256').update(providedSecret).digest('hex');
    if (hash !== record.hashedSecret) return { success: false, error: "Invalid agent secret" };

    return { success: true, walletId: record.walletId };
}

async function saveWalletId(agentName, walletId, rawSecret) {
    if (mongoPromise) await mongoPromise;
    if (agentCollection) {
        const hashedSecret = crypto.createHash('sha256').update(rawSecret).digest('hex');
        await agentCollection.updateOne(
            { agentName }, 
            { $set: { agentName, walletId, hashedSecret, updatedAt: new Date() } }, 
            { upsert: true }
        );
    }
}

async function getUsdcTokenId(walletId) {
    if (!client) return null;
    try {
        const response = await client.getWalletTokenBalance({ id: walletId }); // Fix: use id
        const balances = response.data.tokenBalances;
        const usdc = balances.find(b => b.token.symbol === "USDC");
        return usdc ? usdc.token.id : process.env.USDC_TOKEN_ID;
    } catch (e) {
        return process.env.USDC_TOKEN_ID;
    }
}

// --- ENDPOINTS ---
app.get('/debug/master', async (req, res) => {
    if (!client || !process.env.MASTER_WALLET_ID) return res.json({ error: "Missing client or master id" });
    try {
        const wallet = await client.getWallet({ id: process.env.MASTER_WALLET_ID });
        // Correct parameter for v1.1.0 is 'id', not 'walletId'
        const bResp = await client.getWalletTokenBalance({ id: process.env.MASTER_WALLET_ID });
        
        res.json({
            address: wallet.data.wallet.address,
            balances: bResp.data.tokenBalances,
            sdk: "@circle-fin/dcw (fixed: id parameter)"
        });
    } catch (e) {
        res.status(500).json({ 
            error: e.message, 
            availableMethods: Object.keys(client).filter(k => k.toLowerCase().includes('balance'))
        });
    }
});

app.get('/health', async (req, res) => {
    if (mongoPromise) await mongoPromise;
    const status = {
        hub: "SENTINEL-v2",
        sdk: client ? "READY" : "BOOTING",
        persistence: agentCollection ? "CONNECTED" : "OFFLINE",
        time: new Date().toISOString()
    };
    res.status(client ? 200 : 503).json(status);
});

app.get('/agents', async (req, res) => {
    if (mongoPromise) await mongoPromise;
    if (!agentCollection) return res.status(503).json({ error: "Persistence Offline" });
    try {
        const agents = await agentCollection.find({}).toArray();
        res.json(agents);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/updateArcIdentity', async (req, res) => {
    if (mongoPromise) await mongoPromise;
    const { agentName, tokenId } = req.body;
    if (!agentCollection) return res.status(503).json({ error: "Persistence Offline" });
    try {
        await agentCollection.updateOne(
            { agentName },
            { $set: { tokenId, identityLinkedAt: new Date() } }
        );
        res.json({ success: true, agentName, tokenId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/onboard', async (req, res) => {
    // 🛡️ Await-Ready Guard: Ensure SDK and Persistence are locked in before processing
    if (mongoPromise) await mongoPromise;
    for (let i = 0; i < 10 && !client; i++) {
        console.log(">> [WAIT] SDK initializing, holding request...");
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!client) return res.status(503).json({ error: "Initializing Hub", details: SDK_LOAD_ERROR });
    const { agentName } = req.body;
    try {
        const response = await client.createWallets({
            idempotencyKey: uuidv4(),
            accountType: "EOA",
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId: process.env.WALLET_SET_ID
        });
        const newWallet = response.data.wallets[0];
        const agentSecret = crypto.randomBytes(32).toString('hex');
        await saveWalletId(agentName, newWallet.id, agentSecret);

        let txId = null;
        let identityTxId = null;
        let hubError = null;
        if (process.env.MASTER_WALLET_ID) {
            try {
                // 1. Hub Sponsors Gas (USDC is Native Gas on ARC)
                console.log(`>> Sponsoring Gas for ${agentName}...`);
                const txResp = await client.createTransaction({
                    idempotencyKey: uuidv4(),
                    walletId: process.env.MASTER_WALLET_ID,
                    blockchain: "ARC-TESTNET",
                    destinationAddress: newWallet.address,
                    amounts: [process.env.SPONSOR_AMOUNT || "0.02"],
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                });
                txId = txResp?.data?.transaction?.id;

                // 2. Agent Registers Identity (with smart retry for the 10s delay)
                console.log(`>> Agent ${agentName} starting registration loop...`);
                for (let attempt = 1; attempt <= 10; attempt++) {
                    try {
                        const mintResp = await client.createContractExecutionTransaction({
                            idempotencyKey: uuidv4(),
                            walletId: newWallet.id, 
                            blockchain: "ARC-TESTNET",
                            contractAddress: process.env.IDENTITY_REGISTRY_CA || "0x8004A818BFB912233c491871b3d84c89A494BD9e",
                            abiFunctionSignature: "register(string)",
                            abiParameters: ["ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei"],
                            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                        });
                        identityTxId = mintResp?.data?.transaction?.id || mintResp?.data?.id;
                        console.log(`>> Identity Registered for ${agentName} on attempt ${attempt}: ${identityTxId}`);
                        break; // Success
                    } catch (e) {
                        const errBody = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                        if (errBody.includes("insufficient") && attempt < 10) {
                            console.log(`>> Attempt ${attempt}: Gas not arrived yet. Retrying in 3s...`);
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        } else {
                            hubError = errBody;
                            console.error(`>> Registration Final Failure (Attempt ${attempt}):`, hubError);
                            break;
                        }
                    }
                }
            } catch(e) {
                hubError = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                console.error(">> Onboarding Logic Failed:", hubError);
            }
        }
        res.json({ 
            success: true, 
            agentId: agentName, 
            agentSecret: agentSecret,
            address: newWallet.address, 
            sponsorshipTxId: txId, 
            identityTxId: identityTxId,
            hubError: hubError
        });
    } catch (e) {
        const errorDetail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [FATAL] Onboarding Request Failed:", errorDetail);
        res.status(500).json({ error: errorDetail });
    }
});

app.post('/execute/:action', async (req, res) => {
    if (!client) return res.status(503).json({ error: "Initializing Hub" });
    const { action } = req.params;
    const { agentId, agentSecret, ...params } = req.body;
    
    const auth = await verifyAgent(agentId, agentSecret);
    if (!auth.success) return res.status(401).json({ error: auth.error });

    const walletId = auth.walletId;

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

        const REGISTRY = process.env.REGISTRY_CA || "0xB2332698FF627c8CD9298Df4dF2002C4c5562862";
        const ESCROW = process.env.ESCROW_CA || "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";

        switch(action) {
            case "register":
                payload.contractAddress = REGISTRY;
                payload.abiFunctionSignature = "register(bool,bool,bytes32,bytes32)";
                payload.abiParameters = [String(params.asSeller), String(params.asVerifier), params.capHash, params.pubKey];
                payload.amount = params.stake;
                break;
            case "placeBid":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "placeBid(uint256,uint256,uint64,bytes32)";
                payload.abiParameters = [String(params.taskId), (parseFloat(params.price) * 10**18).toString(), String(params.eta), params.meta];
                break;
            case "createOpenTask":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8,bool)";
                payload.abiParameters = [String(params.jobDeadline), String(params.bidDeadline), String(params.verifierDeadline), params.taskHash, params.verifiers, String(params.quorumM), String(params.isNano)];
                break;
            case "finalizeTask":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "finalize(uint256)";
                payload.abiParameters = [String(params.taskId)];
                break;
        }
        const resp = await client.createContractExecutionTransaction(payload);
        res.json({ success: true, txId: resp.data.transaction?.id || resp.data?.id });
    } catch (e) {
        const errorDetail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [FATAL] Contract Execution Failed:", errorDetail);
        res.status(500).json({ error: errorDetail });
    }
});

app.post('/payout/nano', async (req, res) => {
    if (!gateway) return res.status(503).json({ error: "Gateway not ready" });
    const { recipient, amount } = req.body;
    try {
        const response = await gateway.pay({ amount, recipient, currency: "USDC" });
        res.json({ success: true, batchId: response.batchId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// --- FINAL LISTENER: Bind only after all routes are registered ---
app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Sovereign Hub online on 0.0.0.0:${PORT}`);
});
