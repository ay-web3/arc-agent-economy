import express from 'express';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import { createPublicClient, http, parseAbi } from 'viem';

// --- THE SOVEREIGN SENTINEL (Definitive Final) ---
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// --- GLOBAL STATE ---
let client = null;
let gateway = null;
let uuidv4 = null;
let SDK_LOAD_ERROR = null;
let mongoClient = null;
let mongoPromise = null;

// --- ARC NETWORK CONFIG ---
const arcTestnet = {
    id: 10247,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc-testnet.arc.io'] } }
};

const pc = createPublicClient({ chain: arcTestnet, transport: http() });

// --- DUAL-RESOLUTION ENGINE ---
async function bootstrap() {
    try {
        uuidv4 = () => crypto.randomUUID();

        const API_KEY = process.env.CIRCLE_API_KEY;
        const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;
        const WALLET_SET_ID = process.env.WALLET_SET_ID;
        const MASTER_WALLET_ID = process.env.MASTER_WALLET_ID; // Sovereign Hub Treasury

        if (API_KEY && ENTITY_SECRET) {
            client = initiateDeveloperControlledWalletsClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET });
            console.log(">> [SENTINEL] Swarm Engines Operational (Keyless Mode).");
        }

        if (process.env.MONGODB_URI) {
            mongoClient = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
            mongoPromise = mongoClient.connect().then(() => {
                console.log(">> [SENTINEL] Memory Persistence Synchronized.");
            });
        }

        // --- CIRCLE x402 GATEWAY INITIALIZATION ---
        const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
        if (API_KEY && GATEWAY_ADDR) {
            gateway = new GatewayClient({
                apiKey: API_KEY,
                gatewayAddress: GATEWAY_ADDR,
                blockchain: "ARC-TESTNET"
            });
            console.log(">> [SENTINEL] Circle x402 Gateway Connected.");
        }
    } catch (e) {
        console.error(">> [FATAL] Logic Restoration Failed:", e.message);
        SDK_LOAD_ERROR = { message: e.message, stack: e.stack, time: new Date().toISOString() };
    }
}

// --- UTILS ---
async function verifyAgent(agentName, providedSecret) {
    if (mongoPromise) await mongoPromise;
    if (!mongoClient || !providedSecret) return { success: false, error: "Missing identity or validation" };
    
    const db = mongoClient.db("arc_swarm");
    const record = await db.collection("agents").findOne({ agentName });
    
    if (!record) {
        console.error(`>> [AUTH_FAIL] Agent Not Found in DB: ${agentName}`);
        return { success: false, error: "Agent unauthorized or not secured" };
    }

    if (!record.hashedSecret) {
        console.error(`>> [AUTH_FAIL] Record missing hashedSecret for: ${agentName}`);
        return { success: false, error: "Agent unauthorized or not secured" };
    }

    const hash = crypto.createHash('sha256').update(providedSecret).digest('hex');
    if (hash !== record.hashedSecret) {
        console.error(`>> [AUTH_FAIL] Secret mismatch for agent: ${agentName}`);
        return { success: false, error: "Invalid agent secret" };
    }

    return { success: true, walletId: record.walletId };
}

async function saveWalletId(agentName, walletId, rawSecret, address) {
    if (mongoPromise) await mongoPromise;
    if (mongoClient) {
        const db = mongoClient.db("arc_swarm");
        const hashedSecret = crypto.createHash('sha256').update(rawSecret).digest('hex');
        await db.collection("agents").updateOne(
            { agentName }, 
            { $set: { agentName, walletId, hashedSecret, address: address.toLowerCase(), updatedAt: new Date() } }, 
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
    const isReady = client && gateway;
    const status = {
        hub: "SENTINEL-v2",
        sdk: client ? "READY" : "BOOTING",
        gateway: gateway ? "READY" : "BOOTING",
        persistence: mongoClient ? "CONNECTED" : "OFFLINE",
        time: new Date().toISOString()
    };
    res.status(isReady ? 200 : 503).json(status);
});

app.get('/admin/swarm-fuel', async (req, res) => {
    if (!gateway || !process.env.MASTER_WALLET_ID) return res.status(503).json({ error: "Engines Offline" });
    try {
        const balances = await gateway.getBalances();
        res.json({
            masterAddress: gateway.address,
            standardWalletUSDC: balances.wallet.formatted,
            nanoGatewayLiquidity: balances.gateway.formattedAvailable,
            status: parseFloat(balances.gateway.formattedAvailable) > 0.005 ? "READY_TO_SWARM" : "NEEDS_FUEL"
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/settle-nano', async (req, res) => {
    try {
        const { taskId, worker, amount } = req.body;
        if (!gateway) return res.status(503).json({ error: "Gateway Offline" });

        // Queue the payment in the Circle x402 Gateway for batching
        const result = await gateway.queuePayment({
            recipientAddress: worker,
            amount: amount,
            metadata: { taskId: String(taskId) }
        });

        console.log(`>> [GATEWAY] Nano-Payment Queued for Task #${taskId}: ${amount} USDC`);
        res.json({ success: true, queueId: result.id });
    } catch (error) {
        console.error("Gateway settlement error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/escrow/create-task', async (req, res) => {
    try {
        const ESCROW = process.env.ESCROW_CA || "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";
        const count = await pc.readContract({
            address: ESCROW,
            abi: [{ name: 'taskCounter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
            functionName: 'taskCounter'
        });
        res.json({ count: Number(count) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/escrow/counter', async (req, res) => {
    try {
        const ESCROW = process.env.ESCROW_CA || "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";
        const count = await pc.readContract({
            address: ESCROW,
            abi: [{ name: 'taskCounter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
            functionName: 'taskCounter'
        });
        res.json({ count: Number(count) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/escrow/task/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ESCROW = process.env.ESCROW_CA || "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";
        
        // Use uint256 for all numeric fields to ensure viem returns BigInts consistently
        const task = await pc.readContract({
            address: ESCROW,
            abi: parseAbi(['function tasks(uint256) view returns (address, address, uint256, uint256, uint256)']),
            functionName: 'tasks',
            args: [BigInt(id)]
        });

        const STATUS_MAP = ["None", "Active", "Hired", "Submitted", "Approved", "Finalized", "Disputed", "Cancelled"];
        res.json({
            id,
            buyer: task[0],
            worker: task[1],
            amount: task[2].toString(),
            status: STATUS_MAP[Number(task[3])],
            approvalTimestamp: Number(task[4])
        });
    } catch (e) {
        console.error(`>> [ESCROW_QUERY_ERROR] Task #${req.params.id}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// IDENTITY_LINKING: Saves the ERC-8004 Identity NFT Token ID to MongoDB
async function linkArcIdentity(agentId, tokenId) {
    const db = mongoClient.db("arc_swarm");
    const agents = db.collection("agents");
    await agents.updateOne({ agentName: agentId }, { $set: { arcIdentityTokenId: tokenId.toString(), identityLinkedAt: new Date() } });
}

// PROFILE_QUERY: Retrieves the decentralized reputation profile (SDK expectation)
app.get('/registry/profile/:address', async (req, res) => {
    if (mongoPromise) await mongoPromise;
    const { address } = req.params;
    if (!mongoClient) return res.status(503).json({ error: "Persistence Offline" });
    const db = mongoClient.db("arc_swarm");
    const agents = db.collection("agents");
    const profile = await agents.findOne({ address: address.toLowerCase() });
    if (!profile) return res.status(404).json({ error: "Profile Not Found" });
    res.json({ address, profile });
});

// ERC-8004 Identity Update (SDK Official Sync)
app.post('/updateArcIdentity', async (req, res) => {
    if (mongoPromise) await mongoPromise;
    const { agentId, agentSecret, tokenId } = req.body;
    const auth = await verifyAgent(agentId, agentSecret);
    if (!auth.success) return res.status(401).json({ error: auth.error });
    
    await linkArcIdentity(agentId, tokenId);
    res.json({ success: true, agentId, tokenId });
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
        const db = mongoClient.db("arc_swarm");
        const existingAgent = await db.collection("agents").findOne({ agentName });
        
        if (existingAgent) {
            console.log(`>> [RECOVERY] Identity restored for: ${agentName} (${existingAgent.address})`);
            return res.json({ 
                success: true, 
                agentId: agentName, 
                agentSecret: existingAgent.agentSecret, 
                address: existingAgent.address, 
                sponsorshipTxId: null, 
                hubError: null,
                recovered: true
            });
        }

        const response = await client.createWallets({
            idempotencyKey: uuidv4(),
            accountType: "EOA",
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId: process.env.WALLET_SET_ID
        });
        const newWallet = response.data.wallets[0];
        const agentSecret = crypto.randomBytes(32).toString('hex');
        
        // PERSISTENCE_SYNC: Securely save the identity and hash the secret for verifyAgent
        await saveWalletId(agentName, newWallet.id, agentSecret, newWallet.address);

        let txId = null;
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
            } catch (e) {
                const errBody = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                hubError = errBody;
                console.error(">> Sponsorship Failed:", hubError);
            }
        }
        res.json({ 
            success: true, 
            agentId: agentName, 
            agentSecret: agentSecret,
            address: newWallet.address, 
            sponsorshipTxId: txId, 
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
    
    // Aligns with ArcManagedSDK top-level spread pattern (...params)
    const payload = req.body;
    const effectiveName = payload.agentId || payload.agentName;
    
    const auth = await verifyAgent(effectiveName, payload.agentSecret);
    if (!auth.success) return res.status(401).json({ error: auth.error });

    const walletId = auth.walletId;
    const params = payload; // Redirect params to top-level payload

    try {
        let payload = {
            idempotencyKey: uuidv4(),
            walletId: walletId,
            blockchain: "ARC-TESTNET",
            contractAddress: "",
            abiFunctionSignature: "",
            abiParameters: [],
            amount: "0",
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        };

        const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_CA || "0x8004A818BFB912233c491871b3d84c89A494BD9e";
        const REGISTRY = process.env.REGISTRY_CA || "0xcC95C81656c588ADbB1929ec42991124d746Ad21";
        const ESCROW = process.env.ESCROW_CA || "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";
        const GATEWAY = process.env.CIRCLE_GATEWAY_ADDRESS || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
        const SDK_LOAD_ERROR = null;

        const toWei = (val) => {
            if (!val || val === "0") return "0";
            try {
                return (BigInt(Math.floor(parseFloat(val) * 1e9)) * BigInt(1e9)).toString();
            } catch(e) { return "0"; }
        };

        const pad32 = (hex) => {
            if (!hex) return "0x" + "0".repeat(64);
            if (hex.startsWith("0x")) hex = hex.slice(2);
            return "0x" + hex.padEnd(64, '0');
        };

        switch(action) {
            case "register":
                payload.contractAddress = REGISTRY;
                payload.abiFunctionSignature = "register(bool,bool,bytes32,bytes32)";
                payload.abiParameters = [String(params.asSeller), String(params.asVerifier), pad32(params.capHash), pad32(params.pubKey)];
                // FIX: Circle SDK expects human-readable strings (e.g. "8"), it handles wei conversion internally!
                payload.amount = params.amount || params.stake || "0"; 
                break;
            case "createOpenTask":
                payload.contractAddress = ESCROW;
                // Bypass Circle's ABI packer — encode calldata ourselves with viem
                const { encodeFunctionData, parseAbi } = await import('viem');
                const vArr = Array.isArray(params.verifiers) ? params.verifiers : [params.verifiers];
                const taskAbi = parseAbi([
                    'function createOpenTask(uint64 jobDeadline, uint64 bidDeadline, uint64 verifierDeadline, bytes32 taskHash, address[] _verifiers, uint8 quorumM, bool isNano) external payable returns (uint256 taskId)'
                ]);
                payload.callData = encodeFunctionData({
                    abi: taskAbi,
                    functionName: 'createOpenTask',
                    args: [
                        toWei(params.amount || params.value), // _amount
                        BigInt(params.jobDeadline),
                        BigInt(params.bidDeadline),
                        BigInt(params.verifierDeadline),
                        pad32(params.taskHash),
                        vArr,
                        Number(params.quorumM),
                        params.isNano === true || params.isNano === "true"
                    ]
                });
                // callData is mutually exclusive with abiFunctionSignature/abiParameters
                delete payload.abiFunctionSignature;
                delete payload.abiParameters;
                payload.amount = params.amount || params.value || "0";
                break;
            case "placeBid":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "placeBid(uint256,uint256,uint64,bytes32)";
                payload.abiParameters = [String(params.taskId), toWei(params.price), String(params.eta), pad32(params.meta)];
                break;
            case "selectBid":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "selectBid(uint256,uint256)";
                payload.abiParameters = [String(params.taskId), String(params.bidIndex)];
                break;
            case "submitResult":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "submitResult(uint256,bytes32,string)";
                payload.abiParameters = [String(params.taskId), pad32(params.hash), params.uri];
                break;
            case "approve":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "approve(uint256)";
                payload.abiParameters = [String(params.taskId)];
                break;
            case "finalize":
                payload.contractAddress = ESCROW;
                payload.abiFunctionSignature = "finalize(uint256)";
                payload.abiParameters = [String(params.taskId)];
                break;
            case "topUpStake":
                payload.contractAddress = REGISTRY;
                payload.abiFunctionSignature = "topUpStake()";
                payload.abiParameters = [];
                payload.amount = params.amount || "0";
                break;
            case "transfer":
                // Standard Native Token Transfer (USDC on ARC)
                delete payload.contractAddress;
                delete payload.abiFunctionSignature;
                delete payload.abiParameters;
                payload.destinationAddress = params.recipient || params.to;
                payload.amounts = [String(params.amount || params.value)];
                // Circle SDK createTransaction uses different structure than contract execution
                console.log(">> [DEBUG] Executing Transfer...");
                const txResp = await client.createTransaction(payload);
                return res.json({ success: true, txId: txResp.data.transaction?.id });
            default:
                return res.status(400).json({ error: "Unknown action" });
        }
        console.log(">> [DEBUG] Circle Payload:", JSON.stringify(payload, null, 2));
        const resp = await client.createContractExecutionTransaction(payload);
        const txId = resp.data.transaction?.id || resp.data?.id;
        res.json({ success: true, txId });
    } catch (e) {
        const errorDetail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [FATAL] Contract Execution Failed:", errorDetail);
        res.status(500).json({ error: errorDetail });
    }
});

// --- TRANSACTION STATUS POLLING ---
app.get('/tx-status/:id', async (req, res) => {
    try {
        const resp = await client.getTransaction({ id: req.params.id });
        const tx = resp.data?.transaction;
        res.json({
            id: tx?.id,
            state: tx?.state,
            errorReason: tx?.errorReason || null,
            txHash: tx?.txHash || null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/payout/nano', async (req, res) => {
    const { adminSecret, amount, recipient } = req.body;
    if (adminSecret !== process.env.HUB_ADMIN_SECRET) return res.status(401).json({ error: "Unauthorized" });

    try {
        console.log(`>> [X402] Executing Sovereign Nano-Payout to ${recipient} (Amount: ${amount} USDC)...`);
        
        const masterWalletId = process.env.MASTER_WALLET_ID;
        if (!masterWalletId) {
            throw new Error("MASTER_WALLET_ID is not configured in the Sovereign environment.");
        }

        // Auto-resolve USDC Token ID
        const balancesResp = await client.getWalletTokenBalance({ id: masterWalletId });
        const tokens = balancesResp.data?.tokenBalances || [];
        const usdcToken = tokens.find(t => t.token?.symbol === 'USDC');
        
        if (!usdcToken) {
            throw new Error("No USDC token balance found in the Hub Treasury (MASTER_WALLET_ID).");
        }

        // Execute Nano-Settlement via Circle SDK
        const payoutPayload = {
            walletId: masterWalletId,
            tokenId: usdcToken.token.id,
            destinationAddress: recipient,
            amounts: [String(amount)],
            fee: { type: "SPONSORED" }, // Hub sponsors the nano-settlement gas
            idempotencyKey: uuidv4()
        };

        const payoutResp = await client.createTransaction(payoutPayload);
        
        res.json({ success: true, transaction: payoutResp.data });
    } catch (e) {
        console.error(">> [FATAL] Nano-Payout Failed:", e.message);
        res.status(500).json({ error: e.message });
    }
});
// --- FINAL LISTENER: Bind only after all routes are registered ---
// --- BOOTSTRAP INITIATION ---
bootstrap();

app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Sovereign Hub online on 0.0.0.0:${PORT}`);
});
