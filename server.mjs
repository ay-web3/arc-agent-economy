import express from 'express';
import { MongoClient } from 'mongodb';

// --- THE SOVEREIGN SENTINEL (Definitive Final) ---
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 1. IMMEDIATE BINDING: Satisfy Cloud Run health checks INSTANTLY
app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Sovereign Hub online on 0.0.0.0:${PORT}`);
    bootstrap(); // Start background logic
});

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
        console.log(">> [BOOT] Initiating Factory-Corrected SDK Discovery...");

        const sdkModule = await import('@circle-fin/developer-controlled-wallets');
        const initClient = sdkModule.initiateDeveloperControlledWalletsClient || 
                           sdkModule.default?.initiateDeveloperControlledWalletsClient;
        
        if (typeof initClient !== 'function') {
            throw new Error(`CRITICAL: Circle SDK factory not found. Export Keys: ${Object.keys(sdkModule)}`);
        }

        const gatewayModule = await import('@circle-fin/x402-batching');
        const Gateway = gatewayModule.GatewayClient || gatewayModule.default?.GatewayClient || gatewayModule.default;

        const uuidModule = await import('uuid');
        uuidv4 = uuidModule.v4 || uuidModule.default?.v4 || uuidModule.default;

        const API_KEY = process.env.CIRCLE_API_KEY;
        const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;
        const WALLET_SET_ID = process.env.WALLET_SET_ID;
        const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || process.env.GATEWAY_ADDR || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

        if (API_KEY && ENTITY_SECRET) {
            client = initClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET });
            if (Gateway) {
                gateway = new Gateway({ gatewayAddress: GATEWAY_ADDR, blockchain: "ARC-TESTNET" });
            }
            console.log(">> [SUCCESS] Swarm Engines Operational via Factory Fix.");
        }

        if (process.env.MONGODB_URI) {
            console.log(">> [PERSISTENCE] Connecting to MongoDB Atlas...");
            const mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
            mongoPromise = mongo.connect().then(() => {
                agentCollection = mongo.db().collection('agent_registry');
                console.log(">> [PERSISTENCE] Memory Synchronized.");
            });
        }
    } catch (e) {
        console.error(">> [FATAL] Logic Restoration Failed:", e.message);
        SDK_LOAD_ERROR = { message: e.message, stack: e.stack, time: new Date().toISOString() };
    }
}

// --- UTILS ---
async function getWalletId(agentName) {
    if (mongoPromise) await mongoPromise;
    if (agentCollection) {
        const record = await agentCollection.findOne({ agentName });
        return record ? record.walletId : null;
    }
    return null;
}

async function saveWalletId(agentName, walletId) {
    if (mongoPromise) await mongoPromise;
    if (agentCollection) {
        await agentCollection.updateOne({ agentName }, { $set: { agentName, walletId, updatedAt: new Date() } }, { upsert: true });
    }
}

async function getUsdcTokenId(walletId) {
    if (!client) return null;
    try {
        const response = await client.listBalances({ walletId });
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
        // Correct method name for version 1.1.0 is getWalletTokenBalances
        const balances = await client.getWalletTokenBalances({ walletId: process.env.MASTER_WALLET_ID });
        res.json({
            address: wallet.data.wallet.address,
            balances: balances.data.tokenBalances
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack, hint: "Version 1.1.0 uses getWalletTokenBalances" });
    }
});

app.post('/onboard', async (req, res) => {
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
        await saveWalletId(agentName, newWallet.id);

        let txId = null;
        let identityTxId = null;
        let hubError = null;
        if (process.env.MASTER_WALLET_ID) {
            try {
                // 1. Sponsor Native ARC gas (Native ARC, not USDC)
                console.log(`>> Sponsoring Gas for ${agentName} from ${process.env.MASTER_WALLET_ID}...`);
                const tx = await client.createTransaction({
                    idempotencyKey: uuidv4(),
                    walletId: process.env.MASTER_WALLET_ID,
                    blockchain: "ARC-TESTNET",
                    destinationAddress: newWallet.address,
                    amounts: [process.env.SPONSOR_AMOUNT || "0.02"], // No tokenId = Native ARC
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                });
                if (tx.data && tx.data.transaction) {
                    txId = tx.data.transaction.id;
                    console.log(`>> Gas Sponsored: ${txId}.`);
                }

                // 2. Trigger ERC-8004 Identity Minting (Agent mints its own identity)
                console.log(`>> Triggering Self-Mint for ${agentName} via wallet ${newWallet.id}...`);
                const mintTx = await client.createContractExecutionTransaction({
                    idempotencyKey: uuidv4(),
                    walletId: newWallet.id, 
                    blockchain: "ARC-TESTNET",
                    contractAddress: process.env.IDENTITY_REGISTRY_CA || "0x8004A818BFB912233c491871b3d84c89A494BD9e",
                    abiFunctionSignature: "mint(address)",
                    abiParameters: [newWallet.address],
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                });
                if (mintTx.data && mintTx.data.transaction) {
                    identityTxId = mintTx.data.transaction.id;
                    console.log(`>> Identity Minted for ${agentName}: ${identityTxId}`);
                }
            } catch(e) {
                hubError = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                console.error(">> Onboarding Logic Failed:", hubError);
            }
        }
        res.json({ 
            success: true, 
            agentId: agentName, 
            address: newWallet.address, 
            sponsorshipTxId: txId, 
            identityTxId: identityTxId,
            hubError: hubError
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/execute/:action', async (req, res) => {
    if (!client) return res.status(503).json({ error: "Initializing Hub" });
    const { action } = req.params;
    const { agentId, agentSecret, ...params } = req.body;
    
    const walletId = await getWalletId(agentId);
    if (!walletId) return res.status(404).json({ error: "Agent missing" });

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
        res.json({ success: true, txId: resp.data.transaction.id });
    } catch (e) {
        const errorDetail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
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
