import express from 'express';
import { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching';
import { v4 as uuidv4 } from 'uuid';
import { MongoClient } from 'mongodb';

// --- GLOBAL DIAGNOSTICS ---
let client = null;
let gateway = null;
let SDK_LOAD_ERROR = null;

process.on('uncaughtException', (err) => {
    console.error('>> [CRITICAL] Uncaught Exception:', err.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('>> [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(express.json());

/**
 * @title SwarmOrchestratorAPI (V15 - Sync Build)
 * @dev Synchronized with SDK static imports while maintaining Cloud Run resilience.
 */

// --- CONFIGURATION ---
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || process.env.GATEWAY_ADDR || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
const MONGO_URI = process.env.MONGODB_URI;
const REGISTRY_CA = process.env.REGISTRY_CA || "0xB2332698FF627c8CD9298Df4dF2002C4c5562862";
const ESCROW_CA = process.env.ESCROW_CA || "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";
const MASTER_WALLET_ID = process.env.MASTER_WALLET_ID;
const SPONSOR_AMOUNT = process.env.SPONSOR_AMOUNT || "0.02";

// --- INITIALIZATION ---
let db = null;
let agentCollection = null;
let IN_MEMORY_DB = {};

async function bootstrap() {
    try {
        console.log(">> [BOOT] Initializing Proven SDK Pattern...");
        
        if (API_KEY && ENTITY_SECRET) {
            // Restore synchronous constructor pattern within the bootstrap closure
            client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);
            gateway = new GatewayClient({ 
                gatewayAddress: GATEWAY_ADDR, 
                blockchain: "ARC-TESTNET" 
            });
            console.log(">> [SUCCESS] Swarm Engines Operational.");
        } else {
            console.warn(">> [WARN] Initialization bypassed: Missing Secrets.");
        }

        if (MONGO_URI) {
            console.log(">> [PERSISTENCE] Connecting to MongoDB Atlas...");
            const mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
            await mongoClient.connect();
            db = mongoClient.db();
            agentCollection = db.collection('agent_registry');
            console.log(">> [PERSISTENCE] MongoDB Connected Successfully.");
        }
    } catch (e) {
        console.error(">> [FATAL] Hub Initialization Failed:", e.message);
        SDK_LOAD_ERROR = { message: e.message, stack: e.stack, time: new Date().toISOString() };
    }
}

// --- UTILS ---
async function getWalletId(agentName) {
    if (agentCollection) {
        const record = await agentCollection.findOne({ agentName });
        return record ? record.walletId : null;
    }
    return IN_MEMORY_DB[agentName];
}

async function saveWalletId(agentName, walletId) {
    if (agentCollection) {
        await agentCollection.updateOne({ agentName }, { $set: { agentName, walletId, updatedAt: new Date() } }, { upsert: true });
    } else {
        IN_MEMORY_DB[agentName] = walletId;
    }
}

async function getUsdcTokenId(walletId) {
    if (!client) return null;
    try {
        const response = await client.listBalances({ walletId });
        const balances = response.data.tokenBalances;
        const usdc = balances.find(b => b.token.symbol === "USDC" || b.token.name.includes("USDC"));
        return usdc ? usdc.token.id : process.env.USDC_TOKEN_ID;
    } catch (e) {
        console.error(">> [DISCOVERY] Failed to resolve USDC Token ID:", e.message);
        return process.env.USDC_TOKEN_ID;
    }
}

// --- ENDPOINTS ---
app.get('/health', (req, res) => {
    res.json({ 
        status: "READY", 
        sdk_initialized: !!client,
        persistence: agentCollection ? "MONGODB" : "IN_MEMORY",
        error: SDK_LOAD_ERROR,
        network: "ARC-TESTNET"
    });
});

app.post('/onboard', async (req, res) => {
    if (!client) return res.status(503).json({ error: "Orchestrator not ready", details: SDK_LOAD_ERROR });
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
        await saveWalletId(agentName, newWallet.id);

        let sponsorshipTxId = null;
        if (MASTER_WALLET_ID) {
            const tokenId = await getUsdcTokenId(MASTER_WALLET_ID);
            if (tokenId) {
                const txResponse = await client.createTransaction({
                    idempotencyKey: uuidv4(),
                    walletId: MASTER_WALLET_ID,
                    blockchain: "ARC-TESTNET",
                    tokenId: tokenId,
                    destinationAddress: newWallet.address,
                    amounts: [SPONSOR_AMOUNT],
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                });
                sponsorshipTxId = txResponse.data.transaction.id;
            }
        }

        res.json({ success: true, agentId: agentName, address: newWallet.address, sponsorshipTxId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/execute', async (req, res) => {
    if (!client) return res.status(503).json({ error: "Orchestrator not ready" });
    const { agentId, action, params } = req.body;
    const walletId = await getWalletId(agentId);
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
        }

        const response = await client.createContractExecutionTransaction(payload);
        res.json({ success: true, txId: response.data.transaction.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

const PORT = process.env.PORT || 8080;

// FAST BINDING: Bypasses ESM hoisting timeout during resolution
app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Swarm Sync Hub active on 0.0.0.0:${PORT}`);
    bootstrap();
});
