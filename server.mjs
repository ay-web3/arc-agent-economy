import express from 'express';
import { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching';
import { v4 as uuidv4 } from 'uuid';
import { MongoClient } from 'mongodb';

const app = express();
app.use(express.json());

/**
 * @title SwarmOrchestratorAPI (Advanced Production Edition)
 * @dev Hardened pathing, ESM loader-forced, and Persistent MongoDB Mapping.
 */

// --- DYNAMIC CONFIGURATION ---
const API_KEY = process.env.CIRCLE_API_KEY;
// Handle aliases (CIRCLE_ENTITY_SECRET vs ENTITY_SECRET)
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;
// Handle aliases (CIRCLE_GATEWAY_ADDRESS vs GATEWAY_ADDR)
const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || process.env.GATEWAY_ADDR || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const REGISTRY_CA = process.env.REGISTRY_CA || "0xB2332698FF627c8CD9298Df4dF2002C4c5562862";
const ESCROW_CA = process.env.ESCROW_CA || "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";

const MONGO_URI = process.env.MONGODB_URI;
let db = null;
let agentCollection = null;

// --- INITIALIZATION ---
const client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);
const gateway = new GatewayClient({ 
    gatewayAddress: GATEWAY_ADDR, 
    blockchain: "ARC-TESTNET" 
});

// In-memory fallback if Mongo isn't provided
let IN_MEMORY_DB = {};

async function initDB() {
    if (MONGO_URI) {
        try {
            const mongoClient = new MongoClient(MONGO_URI);
            await mongoClient.connect();
            db = mongoClient.db();
            agentCollection = db.collection('agent_registry');
            console.log(">> [PERSISTENCE] MongoDB Connected Successfully.");
        } catch (e) {
            console.error(">> [ERROR] MongoDB Connection Failed, using in-memory fallback.", e.message);
        }
    } else {
        console.log(">> [PERSISTENCE] No MONGODB_URI provided, using in-memory storage.");
    }
}

// --- HELPER WRAPPERS ---
async function getWalletId(agentName) {
    if (agentCollection) {
        const record = await agentCollection.findOne({ agentName });
        return record ? record.walletId : null;
    }
    return IN_MEMORY_DB[agentName];
}

async function saveWalletId(agentName, walletId) {
    if (agentCollection) {
        await agentCollection.updateOne(
            { agentName },
            { $set: { agentName, walletId, updatedAt: new Date() } },
            { upsert: true }
        );
    } else {
        IN_MEMORY_DB[agentName] = walletId;
    }
}

// --- ENDPOINTS ---
app.get('/health', async (req, res) => {
    res.json({ 
        status: "READY", 
        network: "ARC-TESTNET", 
        persistence: agentCollection ? "MONGODB" : "IN_MEMORY",
        contracts: { registry: REGISTRY_CA, escrow: ESCROW_CA }
    });
});

app.post('/onboard', async (req, res) => {
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

        res.json({ success: true, agentId: agentName, address: newWallet.address, walletId: newWallet.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/execute', async (req, res) => {
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
    const { recipient, amount } = req.body;
    try {
        const response = await gateway.pay({
            amount: amount,
            recipient: recipient,
            currency: "USDC"
        });
        res.json({ success: true, batchId: response.batchId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 8080;

initDB().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`[ORCHESTRATOR] Advanced Swarm Logic active on 0.0.0.0:${PORT}`);
    });
});
