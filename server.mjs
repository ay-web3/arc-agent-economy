import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import axios from 'axios';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import { createPublicClient, http, parseAbi, encodeFunctionData, verifyTypedData } from 'viem';

process.on('unhandledRejection', (reason, promise) => {
    console.error('>> [CRASH PREVENTED] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('>> [CRASH PREVENTED] Uncaught Exception:', err);
});

const USDC_ADDR = "0x7f5c764cc1f01d99da8362b72e25597930869677";

// --- THE SOVEREIGN SENTINEL (Definitive Final) ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve the Monitor UI

const PORT = process.env.PORT || 8080;

// --- GLOBAL STATE ---
let client = null;
let gateway = null;
let uuidv4 = null;
let SDK_LOAD_ERROR = null;
let mongoClient = null;
let mongoPromise = null;
let MASTER_ADDRESS = null;
let gatewayMw = null;
const nanoLedger = []; // Global in-memory swarm ledger
const adminClients = []; // SSE connections
const a2aRegistry = []; // A2A Marketplace registry
const taskBoard = []; // Bounty marketplace task board

// --- ARC NETWORK CONFIG ---
const arcTestnet = {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } }
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

        if (!API_KEY || !ENTITY_SECRET) {
            throw new Error("Missing required environment variables: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET");
        }

        client = initiateDeveloperControlledWalletsClient({ apiKey: API_KEY, entitySecret: ENTITY_SECRET });
        
        console.log(">> [SENTINEL] Swarm Engines Operational.");

        if (!process.env.MONGODB_URI) {
            throw new Error("Missing required environment variable: MONGODB_URI");
        }

        mongoClient = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
        mongoPromise = mongoClient.connect().then(() => {
            console.log(">> [SENTINEL] Memory Persistence Synchronized.");
        });

        // --- CIRCLE x402 GATEWAY INITIALIZATION ---
        const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS;
        const GATEWAY_KEY = process.env.CIRCLE_GATEWAY_PRIVATE_KEY;
        
        if (!GATEWAY_ADDR || !GATEWAY_KEY) {
            throw new Error("Missing required environment variables: CIRCLE_GATEWAY_ADDRESS or CIRCLE_GATEWAY_PRIVATE_KEY");
        }

        gateway = new GatewayClient({
            gatewayAddress: GATEWAY_ADDR,
            privateKey: GATEWAY_KEY,
            chain: "arcTestnet"
        });

        console.log(">> [SENTINEL] Circle x402 Gateway Connected.");
        // --- SELF-AUTHORIZATION (Ensure Hub has GOVERNANCE_ROLE) ---
        const ESCROW = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
        if (client && MASTER_WALLET_ID) {
            try {
                let wResp;
                if (client.developerControlledWallets) {
                    wResp = await client.developerControlledWallets.getWallet({ id: MASTER_WALLET_ID });
                } else {
                    wResp = await client.getWallet({ id: MASTER_WALLET_ID });
                }
                MASTER_ADDRESS = wResp.data.wallet.address;
                console.log(`>> [WALLET] Master Wallet Initialized: ${MASTER_ADDRESS}`);
                
                // Initialize the x402 Gateway Middleware with the true Master Address
                gatewayMw = createGatewayMiddleware({
                    sellerAddress: MASTER_ADDRESS,
                    networks: ["eip155:5042002"],
                    facilitatorUrl: "https://gateway-api-testnet.circle.com"
                });
                console.log(`>> [GATEWAY] x402 Gateway Middleware Initialized.`);

                console.log(">> [SENTINEL] Verifying Governance Permissions...");
                const GOV_ROLE = "0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1";
                
                const hasRoleResp = await pc.readContract({
                    address: ESCROW,
                    abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
                    functionName: 'hasRole',
                    args: [GOV_ROLE, MASTER_ADDRESS]
                });

                if (!hasRoleResp) {
                    console.warn(">> [CRITICAL] Treasury LACKS GOVERNANCE_ROLE on Escrow!");
                } else {
                    console.log(">> [SENTINEL] Governance Permissions Verified.");
                }
            } catch (e) {
                console.warn(">> [WARNING] Treasury Resolution Failed:", e.message);
            }
        }
        await loadTasksFromDB();
    } catch (e) {
        console.error(">> [FATAL] Logic Restoration Failed:", e.message);
        SDK_LOAD_ERROR = { message: e.message, stack: e.stack, time: new Date().toISOString() };
    }
}

// --- UTILS ---
async function saveWalletId(agentName, walletId, rawSecret, address, ownerColdWallet) {
    if (mongoPromise) await mongoPromise;
    if (mongoClient) {
        const db = mongoClient.db("arc_swarm");
        const hashedSecret = crypto.createHash('sha256').update(rawSecret).digest('hex');
        await db.collection("agents").updateOne(
            { agentName }, 
            { $set: { 
                agentName, 
                walletId, 
                hashedSecret, 
                displaySecret: rawSecret, // Store for demo recovery
                ownerColdWallet, // Cold Sink Destination
                address: address.toLowerCase(), 
                updatedAt: new Date() 
            } }, 
            { upsert: true }
        );
    }
}

const USDC_TOKEN_ID = "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";

async function getUsdcTokenId(walletId) {
    if (!client) return null;
    try {
        console.log(`>> [FUEL] Resolving USDC TokenId for Wallet: ${walletId}`);
        let response;
        if (client.developerControlledWallets) {
            response = await client.developerControlledWallets.getWalletTokenBalance({ id: walletId });
        } else {
            response = await client.getWalletTokenBalance({ id: walletId });
        }
        
        const balances = response.data.tokenBalances;
        console.log(`>> [FUEL] Found ${balances.length} tokens in Master Wallet.`);
        // MUST find the Native Gas USDC for ARC Testnet x402 batching!
        const usdc = balances.find(b => b.token.symbol === "USDC" && b.token.isNative);
        if (usdc) {
            console.log(`>> [FUEL] USDC TokenId Resolved: ${usdc.token.id}`);
            return usdc.token.id;
        }
        console.warn(">> [FUEL] USDC Token not found in wallet balances. Falling back to hardcoded.");
        return USDC_TOKEN_ID;
    } catch (e) {
        console.error(`>> [FUEL] Failed to fetch balances: ${e.message}`);
        return USDC_TOKEN_ID;
    }
}

// --- LEDGER PERSISTENCE ---
// Persist nanoLedger entries to MongoDB so they survive server restarts/deploys
async function persistLedgerEntry(entry) {
    if (!entry.timestamp) entry.timestamp = new Date().toISOString();
    nanoLedger.unshift(entry);
    adminClients.forEach(c => c.write(`data: ${JSON.stringify({ type: 'LEDGER_UPDATE', entry })}\n\n`));
    try {
        if (mongoPromise) await mongoPromise;
        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            await db.collection("ledger").insertOne({ ...entry, _persistedAt: new Date() });
        }
    } catch (e) {
        console.error(">> [LEDGER] Failed to persist entry:", e.message);
    }
}

// --- ENDPOINTS ---
app.get('/debug/wallet/:id', async (req, res) => {
    if (!client) return res.json({ error: "Engines Offline" });
    try {
        const wallet = await client.getWallet({ id: req.params.id });
        const bResp = await client.getWalletTokenBalance({ id: req.params.id });
        res.json({ id: req.params.id, address: wallet.data.wallet.address, balances: bResp.data.tokenBalances });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/debug/wallets', async (req, res) => {
    if (!client) return res.json({ error: "Engines Offline" });
    try {
        const resp = await client.listWallets({ walletSetId: process.env.WALLET_SET_ID });
        res.json(resp.data.wallets.map(w => ({ id: w.id, address: w.address })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

app.get('/debug/transactions', async (req, res) => {
    if (!client || !process.env.MASTER_WALLET_ID) return res.json({ error: "Missing client or master id" });
    try {
        const tResp = await client.listTransactions({ 
            walletIds: [process.env.MASTER_WALLET_ID],
            pageSize: 5
        });
        res.json(tResp.data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/debug/transaction/:id', async (req, res) => {
    if (!client) return res.json({ error: "Engines Offline" });
    try {
        const tResp = await client.getTransaction({ id: req.params.id });
        res.json(tResp.data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        let totalTasks = 0;
        let totalVolume = 0;

        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            totalTasks = await db.collection("ledger").countDocuments();
            
            const ledgerDocs = await db.collection("ledger").find({}).toArray();
            ledgerDocs.forEach(tx => {
                if (tx.type !== "a2a_slashed") {
                    totalVolume += parseFloat(tx.price || 0);
                }
            });
        } else {
            totalTasks = nanoLedger.length;
            nanoLedger.forEach(tx => {
                if (tx.type !== "a2a_slashed") {
                    totalVolume += parseFloat(tx.price || 0);
                }
            });
        }

        res.json({ 
            totalTasks, 
            totalVolume: totalVolume.toFixed(4), 
            tvl: "0", 
            revenue: "0", 
            costs: "0", 
            globalSupplyTasks: 0, 
            protocolRevenue: "0" 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        blockchain: {
            name: "Arc Testnet",
            chainId: 5042002,
            rpcUrl: "https://rpc.testnet.arc.network",
            explorerUrl: "https://explorer.testnet.arc.network"
        },
        contracts: {
            usdc: USDC_ADDR || "0x7f5c764cc1f01d99da8362b72e25597930869677",
            gatewayAddress: process.env.CIRCLE_GATEWAY_ADDRESS || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B"
        },
        hub: {
            url: "https://arc-agent-economy.onrender.com"
        }
    });
});

app.get('/api/nano-history', async (req, res) => {
    try {
        if (!mongoClient) return res.json({ success: true, history: nanoLedger });
        const db = mongoClient.db("arc_swarm");
        const history = await db.collection("ledger").find().sort({_id:-1}).limit(100).toArray();
        res.json({ success: true, history });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Global native services array moved outside the endpoint
const nativeServices = [
    {
        id: 'poly-trump',
        serviceName: "Polymarket Predict: Trump v Biden",
        description: "Real-time odds & probability stream. BATCHED nano-settlement via Circle USDC.",
        price: 0.1,
        endpoint: "/api/polymarket/stream/0x7b88dbbdfcd893ffb2ea4c944111394a179c354e61eeff8a02a4bfdd535c59aa",
        type: "prediction",
        batchable: true,
        provider: "Sovereign Hub (Treasury)",
        reputation: 10
    },
    {
        id: 'poly-trending',
        serviceName: "Polymarket Trending Markets",
        description: "Live discovery of most volatile political markets. GAS-FREE settlement.",
        price: 0.05,
        endpoint: "/api/polymarket/trending",
        type: "discovery",
        batchable: true,
        provider: "Sovereign Hub (Treasury)",
        reputation: 10
    },
    {
        id: 'poly-worldcup',
        serviceName: "Polymarket Predict: FIFA World Cup 2026",
        description: "Live betting odds & probabilities for the 2026 World Cup outright winner. BATCHED nano-settlement.",
        price: 0.1,
        endpoint: "/api/polymarket/stream/worldcup-2026",
        type: "prediction",
        batchable: true,
        provider: "Sovereign Hub (Treasury)",
        reputation: 10
    }
];

app.get('/services/catalog', async (req, res) => {
    const a2aMapped = a2aRegistry.map(s => ({
        ...s,
        serviceName: s.name,
        provider: s.address || "A2A Custom Agent"
    }));

    res.json({ success: true, services: [...nativeServices, ...a2aMapped] });
});

app.get('/health', async (req, res) => {
    if (mongoPromise) await mongoPromise;
    const isReady = client && gateway;
    const status = {
        hub: "SENTINEL-v2",
        sdk: client ? "READY" : "BOOTING",
        gateway: gateway ? "READY" : "BOOTING",
        persistence: mongoClient ? "CONNECTED" : "OFFLINE",
        error: SDK_LOAD_ERROR,
        time: new Date().toISOString()
    };
    res.status(isReady ? 200 : 503).json(status);
});

app.get('/admin/fuel-agent/:address', async (req, res) => {
    if (!client || !process.env.MASTER_WALLET_ID) return res.status(503).json({ error: "Engines Offline" });
    try {
        const { address } = req.params;
        const amount = req.query.amount || "2.0"; // Default to 2.0 if not specified
        const usdcId = await getUsdcTokenId(process.env.MASTER_WALLET_ID) || "0x00000000-0000-0000-0000-000000000000";

        console.log(`>> [FUEL] Introspecting client keys: ${Object.keys(client).join(', ')}`);
        
        let tx;
        try {
            // Pattern 1: Direct method
            tx = await client.createTransaction({
                idempotencyKey: uuidv4(),
                walletId: process.env.MASTER_WALLET_ID,
                tokenId: usdcId,
                amounts: ["0.01"], 
                destinationAddress: address,
                blockchain: "ARC-TESTNET",
                fee: { type: "level", config: { feeLevel: "MEDIUM" } }
            });
        } catch (e1) {
            console.log(`>> [FUEL] Pattern 1 failed: ${e1.message}. Trying Pattern 2...`);
            // Pattern 2: Nested method
            if (client.developerControlledWallets) {
                tx = await client.developerControlledWallets.createTransaction({
                    idempotencyKey: uuidv4(),
                    walletId: process.env.MASTER_WALLET_ID,
                    tokenId: usdcId,
                    amounts: [amount.toString()],
                    destinationAddress: address,
                    blockchain: "ARC-TESTNET",
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                });
            } else {
                throw e1;
            }
        }
        
        console.log(`>> [FUEL] Success. TxId: ${tx.data.id}`);
        res.json({ success: true, txId: tx.data.id });
    } catch (e) {
        console.error(">> [FUEL_ERROR]:", e.message);
        res.status(500).json({ error: e.message });
    }
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

async function verifyAgent(agentName, agentSecret) {
    if (!mongoClient) throw new Error("Database offline");
    const db = mongoClient.db("arc_swarm");
    const hashedSecret = crypto.createHash('sha256').update(agentSecret).digest('hex');
    const agent = await db.collection("agents").findOne({ 
        $or: [
            { agentName, hashedSecret },
            { agentId: agentName, hashedSecret }
        ]
    });
    if (!agent) throw new Error("Invalid agent credentials");
    return agent;
}

app.post('/agent/gateway-deposit', async (req, res) => {
    try {
        const { agentName, agentSecret, amount } = req.body;
        const agent = await verifyAgent(agentName, agentSecret);
        
        const USDC_CA = "0x3600000000000000000000000000000000000000";
        const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
        const depositAmount = Math.round(parseFloat(amount) * 1e6).toString(); // 6 decimals

        console.log(`>> [GATEWAY DEPOSIT] Agent ${agentName}: Approving ${amount} USDC for GatewayWallet...`);

        // Step 1: Approve GatewayWallet to spend USDC
        const approveResp = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agent.walletId,
            blockchain: "ARC-TESTNET",
            abiFunctionSignature: "approve(address,uint256)",
            abiParameters: [GATEWAY_WALLET, depositAmount],
            contractAddress: USDC_CA,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });
        
        const approveTxId = approveResp.data?.transaction?.id || approveResp.data?.id;
        console.log(`>> [GATEWAY DEPOSIT] Approve TX queued: ${approveTxId}`);
        
        // Wait for approve to be mined
        let approveState = "QUEUED";
        let approveTxHash = null;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const txCheck = await client.getTransaction({ id: approveTxId });
                approveState = txCheck.data?.transaction?.state || "UNKNOWN";
                approveTxHash = txCheck.data?.transaction?.txHash || null;
                if (approveState === "COMPLETE" || approveState === "CONFIRMED") break;
                if (approveState === "FAILED" || approveState === "DENIED") {
                    throw new Error(`Approve TX failed: ${approveState}`);
                }
            } catch(e) { if (e.message.includes('failed')) throw e; }
        }
        console.log(`>> [GATEWAY DEPOSIT] Approve TX state: ${approveState}`);

        // Step 2: Deposit into GatewayWallet
        console.log(`>> [GATEWAY DEPOSIT] Depositing ${amount} USDC into GatewayWallet...`);
        const depositResp = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agent.walletId,
            blockchain: "ARC-TESTNET",
            abiFunctionSignature: "deposit(address,uint256)",
            abiParameters: [USDC_CA, depositAmount],
            contractAddress: GATEWAY_WALLET,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        const depositTxId = depositResp.data?.transaction?.id || depositResp.data?.id;
        console.log(`>> [GATEWAY DEPOSIT] Deposit TX queued: ${depositTxId}`);

        // Wait for deposit to be mined
        let depositState = "QUEUED";
        let depositTxHash = null;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const txCheck = await client.getTransaction({ id: depositTxId });
                depositState = txCheck.data?.transaction?.state || "UNKNOWN";
                depositTxHash = txCheck.data?.transaction?.txHash || null;
                if (depositState === "COMPLETE" || depositState === "CONFIRMED") break;
                if (depositState === "FAILED" || depositState === "DENIED") {
                    throw new Error(`Deposit TX failed: ${depositState}`);
                }
            } catch(e) { if (e.message.includes('failed')) throw e; }
        }
        console.log(`>> [GATEWAY DEPOSIT] Deposit TX state: ${depositState}`);

        res.json({ 
            success: true, 
            approveTxId, 
            approveTxHash,
            depositTxId, 
            depositTxHash,
            amount,
            approveState,
            depositState
        });
    } catch (e) {
        console.error(">> [GATEWAY DEPOSIT ERROR]", e.response?.data || e.message);
        res.status(500).json({ error: e.response?.data || e.message });
    }
});

app.post('/agent/gateway-withdraw', async (req, res) => {
    try {
        const { agentName, agentSecret, amount } = req.body;
        const agent = await verifyAgent(agentName, agentSecret);
        
        const USDC_CA = "0x3600000000000000000000000000000000000000";
        const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
        const withdrawAmount = Math.round(parseFloat(amount) * 1e6).toString(); // 6 decimals

        console.log(`>> [GATEWAY WITHDRAW] Agent ${agentName}: Withdrawing ${amount} USDC from GatewayWallet...`);

        // Initiate Withdrawal (locks funds for the withdrawal delay)
        const withdrawResp = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agent.walletId,
            blockchain: "ARC-TESTNET",
            abiFunctionSignature: "initiateWithdrawal(address,uint256)",
            abiParameters: [USDC_CA, withdrawAmount],
            contractAddress: GATEWAY_WALLET,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        const withdrawTxId = withdrawResp.data?.transaction?.id || withdrawResp.data?.id;
        console.log(`>> [GATEWAY WITHDRAW] Withdraw TX queued: ${withdrawTxId}`);

        // Wait for withdraw to be mined
        let withdrawState = "QUEUED";
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const txCheck = await client.getTransaction({ id: withdrawTxId });
                withdrawState = txCheck.data?.transaction?.state || "UNKNOWN";
                if (withdrawState === "COMPLETE" || withdrawState === "CONFIRMED") break;
                if (withdrawState === "FAILED" || withdrawState === "DENIED") {
                    throw new Error(`Withdraw TX failed: ${withdrawState}`);
                }
            } catch(e) { if (e.message.includes('failed')) throw e; }
        }
        console.log(`>> [GATEWAY WITHDRAW] Withdraw TX state: ${withdrawState}`);

        res.json({ 
            success: true, 
            withdrawTxId, 
            amount,
            withdrawState
        });
    } catch (e) {
        console.error(">> [GATEWAY WITHDRAW ERROR]", e.response?.data || e.message);
        res.status(500).json({ error: e.response?.data || e.message });
    }
});

app.post('/agent/gateway-withdraw-instant', async (req, res) => {
    try {
        const { agentName, agentSecret, amount } = req.body;
        const agent = await verifyAgent(agentName, agentSecret);
        
        const USDC_CA = "0x3600000000000000000000000000000000000000";
        const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
        
        console.log(`>> [INSTANT WITHDRAW] Agent ${agentName}: Requesting fast withdrawal of ${amount} USDC...`);

        // 1. Generate the BurnIntent using GatewayClient
        const withdrawAmount = Math.round(parseFloat(amount) * 1e6).toString();
        
        let recipientAddress = agent.walletAddress;
        if (!recipientAddress) {
            const walletResp = await client.getWallet({ id: agent.walletId });
            recipientAddress = walletResp.data?.wallet?.address;
            if (!recipientAddress) throw new Error("Could not fetch wallet address for Admin.");
        }

        // Construct the EIP-712 Domain and Types based on GatewayClient spec
        const typedData = {
            domain: { name: "GatewayWallet", version: "1" },
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" }
                ],
                TransferSpec: [
                    { name: "version", type: "uint32" },
                    { name: "sourceDomain", type: "uint32" },
                    { name: "destinationDomain", type: "uint32" },
                    { name: "sourceContract", type: "bytes32" },
                    { name: "destinationContract", type: "bytes32" },
                    { name: "sourceToken", type: "bytes32" },
                    { name: "destinationToken", type: "bytes32" },
                    { name: "sourceDepositor", type: "bytes32" },
                    { name: "destinationRecipient", type: "bytes32" },
                    { name: "sourceSigner", type: "bytes32" },
                    { name: "destinationCaller", type: "bytes32" },
                    { name: "value", type: "uint256" },
                    { name: "salt", type: "bytes32" },
                    { name: "hookData", type: "bytes" }
                ],
                BurnIntent: [
                    { name: "maxBlockHeight", type: "uint256" },
                    { name: "maxFee", type: "uint256" },
                    { name: "spec", type: "TransferSpec" }
                ]
            },
            primaryType: "BurnIntent",
            message: (() => {
                const intent = gateway.createBurnIntent(
                    gateway.chainConfig,
                    gateway.chainConfig, // destConfig is same as source (ARC-TESTNET)
                    withdrawAmount,
                    recipientAddress, // recipient
                    "2010000" // maxFee (2.01 USDC, standard default)
                );
                const padToBytes32 = (addr) => "0x" + addr.toLowerCase().replace("0x", "").padStart(64, "0");
                intent.spec.sourceSigner = padToBytes32(recipientAddress);
                intent.spec.sourceDepositor = padToBytes32(recipientAddress);
                return intent;
            })()
        };

        // 2. Sign Typed Data via Circle Web3 Services
        console.log(`>> [INSTANT WITHDRAW] Signing BurnIntent via Circle Web3 Services...`);
        const signResp = await client.signTypedData({
            walletId: agent.walletId,
            data: JSON.stringify(typedData, (_, v) => typeof v === 'bigint' ? v.toString() : v),
            memo: "Gateway Fast Withdrawal"
        });

        if (!signResp.data || !signResp.data.signature) {
            throw new Error("Failed to obtain EIP-712 signature from Circle API.");
        }

        const signature = signResp.data.signature;

        // 3. Submit to Gateway API for Settlement
        console.log(`>> [INSTANT WITHDRAW] Submitting signed intent to Gateway Operator...`);
        const apiUrl = "https://gateway-api-testnet.circle.com/v1"; // Testnet API
        const response = await fetch(`${apiUrl}/transfer`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...gateway.gatewayApiHeaders()
            },
            body: JSON.stringify(
                [{ burnIntent: typedData.message, signature }],
                (_, v) => typeof v === "bigint" ? v.toString() : v
            )
        });

        const result = await response.json();
        if (result.success === false || result.error || !result.attestation || !result.signature) {
            throw new Error(`Gateway API error: ${result.message || result.error || JSON.stringify(result)}`);
        }

        // 4. Mint on Destination (ARC-TESTNET)
        console.log(`>> [INSTANT WITHDRAW] Attestation received! Executing gatewayMint on-chain...`);
        const mintTxResp = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agent.walletId,
            blockchain: "ARC-TESTNET",
            abiFunctionSignature: "gatewayMint(bytes,bytes)",
            abiParameters: [result.attestation, result.signature],
            contractAddress: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B", // GatewayMinter (from SDK chainConfig)
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        console.log("Instant Withdrawal Tx ID:", mintTxResp.data.id);
        res.json({ success: true, withdrawTxId: mintTxResp.data.id, amount, state: mintTxResp.data.state });
    } catch (err) {
        console.error("Instant Gateway Withdraw Error:", err);
        res.status(500).json({ error: "Instant Withdraw failed: " + (err.response?.data?.message || err.message) });
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
    const { agentName, ownerColdWallet } = req.body;
    try {
        const db = mongoClient.db("arc_swarm");
        const existingAgent = await db.collection("agents").findOne({ agentName });
        
        if (existingAgent) {
            console.log(`>> [RECOVERY] Identity restored for: ${agentName} (${existingAgent.address})`);
            // RECOVERY FIX: Return the stored displaySecret or a definitive fallback for persistent identities
            const recoveredSecret = existingAgent.displaySecret || "SOVEREIGN_SECRET_2026";
            return res.json({ 
                success: true, 
                agentId: agentName, 
                agentSecret: recoveredSecret, 
                address: existingAgent.address, 
                walletId: existingAgent.walletId,
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
        const agentSecret = crypto.randomBytes(16).toString('hex'); // Shorter for easier manual debugging
        
        // PERSISTENCE_SYNC: Securely save the identity and include displaySecret for demo recovery
        await saveWalletId(agentName, newWallet.id, agentSecret, newWallet.address, ownerColdWallet);

        let txId = null;
        let hubError = null;
        let txHash = null;
        if (process.env.MASTER_WALLET_ID) {
            try {
                // 1. Hub Sponsors Gas
                console.log(`>> Sponsoring Gas for ${agentName}...`);
                const usdcId = await getUsdcTokenId(process.env.MASTER_WALLET_ID) || "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";
                const txPayload = {
                    idempotencyKey: uuidv4(),
                    walletId: process.env.MASTER_WALLET_ID,
                    tokenId: usdcId,
                    destinationAddress: newWallet.address,
                    amounts: ["3.50"],
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                };
                
                let txResp;
                if (client.developerControlledWallets) {
                    txResp = await client.developerControlledWallets.createTransaction(txPayload);
                } else {
                    txResp = await client.createTransaction(txPayload);
                }
                txId = txResp?.data?.transaction?.id || txResp?.data?.id;

                // Non-blocking quick poll to try to resolve the hex txHash for better explorer inspection
                for (let i = 0; i < 5; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    try {
                        const check = await client.getTransaction({ id: txId });
                        txHash = check.data?.transaction?.txHash || null;
                        if (txHash) break;
                    } catch (checkErr) {}
                }
            } catch (e) {
                const errBody = e.response?.data ? JSON.stringify(e.response.data) : e.message;
                hubError = errBody;
                console.error(">> Sponsorship Failed:", hubError);
            }
        }
        return res.json({
            success: true,
            agentId: agentName,
            agentName: agentName,
            agentSecret: agentSecret,
            address: newWallet.address,
            walletId: newWallet.id,
            sponsorshipTxId: txId,
            sponsorshipTxHash: txHash,
            hubError: hubError
        });
    } catch (e) {
        const errorDetail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [FATAL] Onboarding Request Failed:", errorDetail);
        res.status(500).json({ error: errorDetail });
    }
});

app.post('/execute/withdrawProfits', async (req, res) => {
    try {
        if (!client) return res.status(503).json({ error: "Circle SDK Offline" });
        const { agentId, agentSecret, amount } = req.body;
        
        const auth = await verifyAgent(agentId, agentSecret);
        if (!auth.ownerColdWallet) {
            return res.status(403).json({ error: "No Cold Wallet Sink bound to this agent." });
        }

        const usdcId = await getUsdcTokenId(auth.walletId) || "15dc2b5d-0994-58b0-bf8c-3a0501148ee8";

        console.log(`>> [COLD SINK] Agent ${agentId} attempting withdrawal. Forcing route to: ${auth.ownerColdWallet}`);

        let tx;
        try {
            tx = await client.createTransaction({
                idempotencyKey: uuidv4(),
                walletId: auth.walletId,
                tokenId: usdcId,
                amounts: [amount.toString()],
                destinationAddress: auth.ownerColdWallet,
                blockchain: "ARC-TESTNET",
                fee: { type: "level", config: { feeLevel: "MEDIUM" } }
            });
        } catch (e1) {
            if (client.developerControlledWallets) {
                tx = await client.developerControlledWallets.createTransaction({
                    idempotencyKey: uuidv4(),
                    walletId: auth.walletId,
                    tokenId: usdcId,
                    amounts: [amount.toString()],
                    destinationAddress: auth.ownerColdWallet,
                    blockchain: "ARC-TESTNET",
                    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
                });
            } else {
                throw e1;
            }
        }

        res.json({ success: true, txId: tx.data.id, destination: auth.ownerColdWallet });
    } catch (e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [COLD SINK ERROR] Withdrawal Failed:", detail);
        res.status(500).json({ error: detail });
    }
});

app.post('/agent/set-cold-wallet', async (req, res) => {
    try {
        const { agentId, agentSecret, ownerColdWallet } = req.body;
        if (!agentId || !agentSecret || !ownerColdWallet) {
            return res.status(400).json({ error: "Missing required fields (agentId, agentSecret, ownerColdWallet)" });
        }

        // Verify the Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(ownerColdWallet)) {
            return res.status(400).json({ error: "Invalid Ethereum address format for ownerColdWallet" });
        }

        // Authenticate agent
        const auth = await verifyAgent(agentId, agentSecret);

        // Update database
        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            await db.collection("agents").updateOne(
                { agentName: agentId },
                { $set: { ownerColdWallet: ownerColdWallet.toLowerCase(), updatedAt: new Date() } }
            );
        }

        console.log(`>> [COLD SINK] Updated ownerColdWallet for agent: ${agentId} -> ${ownerColdWallet}`);
        res.json({ success: true, message: `Successfully bound MetaMask cold wallet: ${ownerColdWallet}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

app.post(['/agent/sign-402', '/agent/sign'], async (req, res) => {
    try {
        const { agentName, agentSecret, typedData } = req.body;
        // Authenticate the agent password
        const agent = await verifyAgent(agentName, agentSecret);
        
        console.log(`>> [PROXY SIGNER] Generating x402 EIP-712 Signature for Agent ${agentName}...`);

        // Use the Hub's ENTITY_SECRET to sign the transaction on the agent's behalf
        // Circle's API expects the typed data to be a stringified JSON object
        const response = await client.signTypedData({
            walletId: agent.walletId,
            data: typeof typedData === 'string' ? typedData : JSON.stringify(typedData)
        });

        // The response contains the hex signature
        res.json({ success: true, signature: response.data.signature });
    } catch (e) {
        console.error(">> [PROXY SIGNER ERROR]", e.response?.data || e.message);
        res.status(500).json({ error: e.response?.data || e.message });
    }
});

// GET Swarm Ledger History
app.get('/api/crypto-insights', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("0.005")(req, res, next);
    },
    async (req, res) => {
        try {
            const token = req.query.token || "bitcoin";
            const cgHeaders = process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : {};
            const cgResp = await fetch(
                `https://api.coingecko.com/api/v3/coins/${token}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
                { headers: cgHeaders }
            );
            if (!cgResp.ok) throw new Error(`CoinGecko returned ${cgResp.status}`);
            const data = await cgResp.json();
            
            persistLedgerEntry({
                service: "Crypto Insights",
                price: 0.005,
                provider: "CoinGecko",
                payloadPreview: JSON.stringify({ symbol: data.symbol?.toUpperCase(), price: data.market_data?.current_price?.usd }),
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                token: data.id,
                symbol: data.symbol?.toUpperCase(),
                price_usd: data.market_data?.current_price?.usd,
                change_24h: data.market_data?.price_change_percentage_24h,
                market_cap: data.market_data?.market_cap?.usd,
                volume_24h: data.market_data?.total_volume?.usd,
                ath: data.market_data?.ath?.usd,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            res.status(502).json({ success: false, error: "Upstream data error: " + e.message });
        }
    }
);

// 2. Pay-Per-Second — Real-Time Price Stream (simulated ticks from live base price)
app.post('/api/stream', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        const seconds = Math.min(req.body?.seconds || 5, 15);
        const cost = (seconds * 0.02).toFixed(2);
        return gatewayMw.require(cost)(req, res, next);
    },
    async (req, res) => {
        try {
            const token = req.body?.token || "ethereum";
            const seconds = Math.min(req.body?.seconds || 5, 60); // cap at 60

            // Fetch live base price
            const cgHeaders = process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : {};
            const cgResp = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`,
                { headers: cgHeaders }
            );
            const cgData = await cgResp.json();
            const basePrice = cgData[token]?.usd;
            if (!basePrice) throw new Error(`No price data for ${token}`);

            persistLedgerEntry({
                service: "Price Stream",
                price: parseFloat((seconds * 0.02).toFixed(2)),
                provider: "CoinGecko Stream",
                duration: seconds,
                payloadPreview: `Live Stream for ${token}: Base $${basePrice} for ${seconds} seconds`,
                timestamp: new Date().toISOString()
            });

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            let livePrice = basePrice;
            let tick = 0;

            const interval = setInterval(() => {
                tick++;
                const noise = (Math.random() - 0.5) * 0.002; // ±0.1% per tick
                livePrice = livePrice * (1 + noise);
                
                const payload = JSON.stringify({
                    tick,
                    base_price: basePrice,
                    price: parseFloat(livePrice.toFixed(4)),
                    change_pct: parseFloat((noise * 100).toFixed(4)),
                    timestamp: new Date().toISOString()
                });

                res.write(`data: ${payload}\n\n`);
                
                // Broadcast to frontend
                adminClients.forEach(c => c.write(`data: ${JSON.stringify({ type: 'CRYPTO_TICK', token, data: JSON.parse(payload) })}\n\n`));

                if (tick >= seconds) {
                    clearInterval(interval);
                    res.end();
                }
            }, 1000);

            req.on('close', () => {
                clearInterval(interval);
            });
        } catch (e) {
            res.status(502).json({ success: false, error: "Stream error: " + e.message });
        }
    }
);

// 3. Pay-Per-Token — Real LLM Reasoning (Gemini 2.0 Flash)
app.post('/api/llm-reasoning', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("0.015")(req, res, next);
    },
    async (req, res) => {
        try {
            const prompt = req.body?.prompt || "Analyze the current state of the crypto market and provide 3 actionable insights for an autonomous trading agent.";
            const groqKey = process.env.GROQ_API_KEY;

            if (!groqKey) {
                return res.status(503).json({ success: false, error: "LLM service not configured (missing GROQ_API_KEY)" });
            }

            const groqResp = await fetch(
                `https://api.groq.com/openai/v1/chat/completions`,
                {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${groqKey}`
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: 512,
                        temperature: 0.7
                    })
                }
            );

            if (!groqResp.ok) {
                const errBody = await groqResp.text();
                throw new Error(`Groq API ${groqResp.status}: ${errBody.substring(0, 200)}`);
            }

            const groqData = await groqResp.json();
            const output = groqData.choices?.[0]?.message?.content || "No output generated.";
            const tokenCount = groqData.usage;

            persistLedgerEntry({
                service: "LLM Reasoning",
                price: 0.015,
                provider: "Groq (Llama 3)",
                tokens: tokenCount?.total_tokens || 0,
                payloadPreview: output.substring(0, 150) + (output.length > 150 ? "..." : ""),
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                model: "llama-3.1-8b-instant",
                prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : ""),
                reasoning: output,
                usage: {
                    prompt_tokens: tokenCount?.prompt_tokens || 0,
                    completion_tokens: tokenCount?.completion_tokens || 0,
                    total_tokens: tokenCount?.total_tokens || 0
                },
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            res.status(502).json({ success: false, error: "LLM error: " + e.message });
        }
    }
);

// 4. Pay-Per-Megabyte — On-Chain ARC Analytics Dataset
app.post('/api/dataset', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("0.1")(req, res, next);
    },
    async (req, res) => {
        try {
            const dataType = req.body?.type || "blocks";
            const limit = Math.min(req.body?.limit || 10, 25);
            let blockNum = 0;
            try { blockNum = await pc.getBlockNumber(); } catch(e) {}

            if (dataType === "blocks") {
                // Fetch recent blocks from ARC-TESTNET
                const blocks = [];
                for (let i = 0; i < limit; i++) {
                    try {
                        const block = await pc.getBlock({ blockNumber: blockNum - BigInt(i) });
                        blocks.push({
                            number: Number(block.number),
                            hash: block.hash,
                            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                            transactions: block.transactions.length,
                            gasUsed: block.gasUsed.toString(),
                            gasLimit: block.gasLimit.toString(),
                            miner: block.miner
                        });
                    } catch (e) { /* skip failed blocks */ }
                }
                const data = {
                    success: true,
                    dataset: "arc_testnet_blocks",
                    chain_id: 5042002,
                    latest_block: Number(blockNum),
                    records: blocks.length,
                    data: blocks
                };
                adminClients.forEach(c => c.write(`data: ${JSON.stringify({ type: 'DATASET_UPDATE', dataType, data })}\n\n`));
                res.json(data);

            } else if (dataType === "transactions") {
                // Fetch transactions from recent blocks
                const txs = [];
                for (let i = 0; i < 5 && txs.length < limit; i++) {
                    try {
                        const block = await pc.getBlock({ blockNumber: blockNum - BigInt(i), includeTransactions: true });
                        for (const tx of block.transactions) {
                            if (txs.length >= limit) break;
                            txs.push({
                                hash: typeof tx === 'string' ? tx : tx.hash,
                                from: typeof tx === 'string' ? null : tx.from,
                                to: typeof tx === 'string' ? null : tx.to,
                                value: typeof tx === 'string' ? null : tx.value?.toString(),
                                block: Number(block.number),
                                timestamp: new Date(Number(block.timestamp) * 1000).toISOString()
                            });
                        }
                    } catch (e) { /* skip */ }
                }
                res.json({
                    success: true,
                    dataset: "arc_testnet_transactions",
                    chain_id: 5042002,
                    records: txs.length,
                    data: txs
                });

            } else if (dataType === "gateway") {
                // Gateway contract analytics
                const USDC_CA = "0x3600000000000000000000000000000000000000";
                const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
                const gatewayBalance = await pc.readContract({
                    address: USDC_CA,
                    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                    functionName: 'balanceOf',
                    args: [GATEWAY_WALLET]
                });
                res.json({
                    success: true,
                    dataset: "arc_gateway_analytics",
                    gateway_contract: GATEWAY_WALLET,
                    usdc_locked: (Number(gatewayBalance) / 1e6).toFixed(6),
                    latest_block: Number(blockNum),
                    chain_id: 5042002,
                    timestamp: new Date().toISOString()
                });

            } else {
                return res.status(400).json({ success: false, error: `Unknown dataset type: ${dataType}. Use: blocks, transactions, or gateway` });
            }

            persistLedgerEntry({
                service: "ARC Analytics",
                price: 0.1,
                provider: "ARC Testnet RPC",
                dataset: dataType,
                payloadPreview: `Chain 5042002: Latest Block #${blockNum}`,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            if (!res.headersSent) res.status(502).json({ success: false, error: "Dataset error: " + e.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// POLYMARKET ORACLE SERVICES
// ═══════════════════════════════════════════════════════════════

// 1. Pay-Per-Request — Probability Oracle
app.get('/api/polymarket/probability/:eventId', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("0.01")(req, res, next);
    },
    async (req, res) => {
        try {
            const eventId = req.params.eventId;
            const polyResp = await fetch(`https://gamma-api.polymarket.com/events/${eventId}`);
            if (!polyResp.ok) throw new Error(`Polymarket returned ${polyResp.status}`);
            const data = await polyResp.json();
            
            const market = data.markets && data.markets[0];
            if (!market) throw new Error("No markets found for this event");

            let outcomePrices = null;
            let outcomes = null;
            if (market.outcomePrices) outcomePrices = JSON.parse(market.outcomePrices);
            if (market.outcomes) outcomes = JSON.parse(market.outcomes);

            const payload = {
                event_id: data.id,
                title: data.title,
                active: data.active,
                market_volume: market.volume,
                outcomes: outcomes,
                probabilities: outcomePrices,
                timestamp: new Date().toISOString()
            };

            persistLedgerEntry({
                service: "Polymarket Probability",
                price: 0.01,
                provider: "Polymarket Oracle",
                payloadPreview: `Event: ${payload.title.substring(0, 50)}...`,
                timestamp: payload.timestamp
            });

            res.json({ success: true, ...payload });
        } catch (e) {
            if (!res.headersSent) res.status(502).json({ success: false, error: "Upstream data error: " + e.message });
        }
    }
);

// 2. Pay-Per-Payload — Trending Sentiment Feed
app.get('/api/polymarket/trending', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("0.05")(req, res, next);
    },
    async (req, res) => {
        try {
            const polyResp = await fetch(`https://gamma-api.polymarket.com/events?active=true&limit=100`);
            if (!polyResp.ok) throw new Error(`Polymarket returned ${polyResp.status}`);
            const data = await polyResp.json();
            
            // Filter specifically for crypto markets to ensure logical LLM arbitrage signals
            const cryptoKeywords = ["btc", "eth", "sol", "bitcoin", "ethereum", "crypto", "binance", "coinbase", "xrp", "doge"];
            let filteredEvents = data.filter(e => {
                const text = (e.title + " " + (e.description || "")).toLowerCase();
                return cryptoKeywords.some(kw => text.includes(kw));
            });
            
            // Fallback to top 5 general if no crypto markets found
            if (filteredEvents.length === 0) filteredEvents = data;
            
            const trending = filteredEvents.slice(0, 5).map(event => ({
                id: event.id,
                title: event.title,
                startDate: event.startDate,
                volume: event.markets && event.markets[0] ? event.markets[0].volume : 0,
                outcomes: event.markets && event.markets[0] && event.markets[0].outcomes ? JSON.parse(event.markets[0].outcomes) : [],
                probabilities: event.markets && event.markets[0] && event.markets[0].outcomePrices ? JSON.parse(event.markets[0].outcomePrices) : []
            }));

            persistLedgerEntry({
                service: "Polymarket Trending",
                price: 0.05,
                provider: "Polymarket Oracle",
                payloadPreview: `Top ${trending.length} active events`,
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, count: trending.length, trending, timestamp: new Date().toISOString() });
        } catch (e) {
            if (!res.headersSent) res.status(502).json({ success: false, error: "Upstream data error: " + e.message });
        }
    }
);

// 3. Pay-Per-Second — Arbitrage Orderbook Stream
app.post('/api/polymarket/stream/:eventId', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        const seconds = parseInt(req.body?.duration_seconds) || 5;
        const cost = (seconds * 0.02).toFixed(2);
        return gatewayMw.require(cost)(req, res, next);
    },
    async (req, res) => {
        try {
            const eventId = req.params.eventId;
            const seconds = parseInt(req.body?.duration_seconds) || 5;
            
            // Initial fetch to get base data
            const polyResp = await fetch(`https://gamma-api.polymarket.com/events/${eventId}`);
            if (!polyResp.ok) throw new Error(`Polymarket returned ${polyResp.status}`);
            const data = await polyResp.json();

            const market = data.markets && data.markets[0];
            if (!market) throw new Error("No markets found for this event");

            let baseBid = parseFloat(market.bestBid) || 0.50;
            let baseAsk = parseFloat(market.bestAsk) || 0.51;

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            let tick = 0;
            const interval = setInterval(() => {
                tick++;
                // Simulate orderbook changes based on base prices
                const bidChange = (Math.random() * 0.02) - 0.01;
                const askChange = (Math.random() * 0.02) - 0.01;
                
                const curBid = Math.max(0.01, Math.min(0.98, baseBid + bidChange)).toFixed(3);
                const curAsk = Math.max(parseFloat(curBid) + 0.01, Math.min(0.99, baseAsk + askChange)).toFixed(3);

                const payload = {
                    tick,
                    eventId,
                    bestBid: parseFloat(curBid),
                    bestAsk: parseFloat(curAsk),
                    spread: parseFloat((parseFloat(curAsk) - parseFloat(curBid)).toFixed(3)),
                    timestamp: new Date().toISOString()
                };
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
                
                // Broadcast to frontend
                adminClients.forEach(c => c.write(`data: ${JSON.stringify({ type: 'POLY_TICK', eventId, data: payload })}\n\n`));

                if (tick >= seconds) {
                    clearInterval(interval);
                    res.end();
                }
            }, 1000);

            persistLedgerEntry({
                service: "Polymarket Orderbook Stream",
                price: parseFloat((seconds * 0.02).toFixed(2)),
                provider: "Polymarket Oracle",
                duration: seconds,
                payloadPreview: `Stream for Event ${eventId} (${seconds}s)`,
                timestamp: new Date().toISOString()
            });

            req.on('close', () => clearInterval(interval));
        } catch (e) {
            if (!res.headersSent) res.status(502).json({ success: false, error: "Upstream data error: " + e.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// AGENT-TO-AGENT SERVICE REGISTRY
// ═══════════════════════════════════════════════════════════════

// In-memory service catalog (backed by MongoDB when available)
const serviceCatalog = new Map();

// Agent Explorer Endpoint
app.get('/api/explorer/agent/:query', async (req, res) => {
    try {
        const query = req.params.query.trim();
        let agentName = query;
        let walletAddress = null;
        let walletId = null;
        let isSlashed = false;
        
        // Check if querying the Master/Admin wallet
        if (query.toLowerCase() === "admin" || query.toLowerCase() === "hub" || query.toLowerCase() === "master") {
            agentName = "Sovereign Hub (Treasury)";
            walletId = process.env.MASTER_WALLET_ID;
            if (!client) throw new Error("Circle SDK offline");
            const walletResp = await client.getWallet({ id: walletId });
            walletAddress = walletResp.data.wallet.address;
        } else {
            // Find in MongoDB
            if (!mongoClient) throw new Error("Database offline");
            const db = mongoClient.db("arc_swarm");
            
            // Search by exact name, address, or ID
            const agent = await db.collection("agents").findOne({
                $or: [
                    { agentName: query },
                    { address: query },
                    { walletId: query }
                ]
            });
            
            if (!agent) {
                return res.status(404).json({ success: false, error: "Agent not found in registry" });
            }
            
            agentName = agent.agentName;
            walletAddress = agent.address;
            walletId = agent.walletId;
            
            // Check if explicitly slashed in the database
            // If they aren't in memory, it just means the server restarted or they went offline, NOT that they lost their stake!
            isSlashed = agent.slashed || false;
        }
        
        // Fetch USDC Balance from Circle API
        let usdcBalance = "0.0";
        try {
            const bResp = await client.getWalletTokenBalance({ id: walletId });
            const tokens = bResp.data?.tokenBalances || [];
            const usdcToken = tokens.find(t => t.token.symbol === "USDC");
            if (usdcToken) {
                usdcBalance = usdcToken.amount;
            }
        } catch(e) { console.error("Balance fetch err:", e.message); }
        
        // Fetch Gateway Stake Balance from the Smart Contract on-chain
        let gatewayBalance = "0.0000";
        try {
            const USDC_CA = "0x3600000000000000000000000000000000000000";
            const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
            
            const gbal = await pc.readContract({
                address: GATEWAY_WALLET,
                abi: parseAbi(['function availableBalance(address, address) view returns (uint256)']),
                functionName: 'availableBalance',
                args: [USDC_CA, walletAddress]
            });
            gatewayBalance = (Number(gbal) / 1e6).toFixed(4);
        } catch (gErr) {
            console.error(">> [EXPLORER] Gateway balance contract read failed, falling back to static discovery:", gErr.message);
            if (agentName === "Sovereign Hub (Treasury)") {
                gatewayBalance = usdcBalance;
            } else if (!isSlashed) {
                gatewayBalance = "3.0000";
            } else {
                gatewayBalance = "0.0000";
            }
        }
        
        // Calculate real statistics from database or memory
        let totalSales = 0;
        let totalRevenue = 0;
        let totalBuying = 0;

        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            
            // Sales & Revenue
            const salesCursor = await db.collection("ledger").find({
                provider: { $regex: new RegExp(`^${agentName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i") }
            }).toArray();
            totalSales = salesCursor.length;
            totalRevenue = salesCursor.reduce((sum, tx) => sum + parseFloat(tx.price || 0), 0);

            // Buying
            totalBuying = await db.collection("ledger").countDocuments({
                $or: [
                    { buyer: walletAddress.toLowerCase() },
                    { from: { $regex: new RegExp(`^${agentName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i") } }
                ]
            });
        } else {
            // Memory fallback
            const sales = nanoLedger.filter(tx => tx.provider?.toLowerCase() === agentName.toLowerCase());
            totalSales = sales.length;
            totalRevenue = sales.reduce((sum, tx) => sum + parseFloat(tx.price || 0), 0);
            
            totalBuying = nanoLedger.filter(tx => 
                tx.buyer?.toLowerCase() === walletAddress.toLowerCase() || 
                tx.from?.toLowerCase() === agentName.toLowerCase()
            ).length;
        }

        res.json({
            success: true,
            agent: {
                agentName,
                walletAddress,
                usdcBalance,
                gatewayBalance,
                isSlashed
            },
            stats: {
                totalRevenue: totalRevenue.toFixed(4),
                totalSales,
                totalBuying
            }
        });
        
    } catch (e) {
        console.error(">> [AGENT EXPLORER ERROR]", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Register a service
app.post('/api/registry/register', async (req, res) => {
    const { name, url, price, description } = req.body;
    if (!name || !url || price === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    let slashCheck = null;
    
    try {
        if (mongoClient && gateway && MASTER_ADDRESS) {
            const db = mongoClient.db("arc_swarm");
            const agentDoc = await db.collection("agents").findOne({ agentName: name });
            
            if (agentDoc && agentDoc.walletId && agentDoc.address) {
                // --- STRICT COLLATERAL CHECK ---
                console.log(`>> [REGISTRATION] Verifying on-chain collateral for ${agentDoc.agentName}...`);
                let usdcBalance = 0;
                const bResp = await client.getWalletTokenBalance({ id: agentDoc.walletId });
                const usdcToken = (bResp.data?.tokenBalances || []).find(t => t.token.symbol === "USDC");
                if (usdcToken) usdcBalance = parseFloat(usdcToken.amount);
                
                if (usdcBalance < 3.0) {
                    console.error(`>> [REGISTRATION REJECTED] Agent ${agentDoc.agentName} has insufficient collateral (${usdcBalance} USDC)`);
                    return res.status(403).json({ error: `Insufficient collateral. You must maintain at least 3.00 USDC in your on-chain wallet to stake a service. Current balance: ${usdcBalance.toFixed(2)} USDC` });
                }
                
                console.log(`>> [DIGITAL CHECK] Generating upfront 3.00 USDC BurnIntent for agent: ${agentDoc.agentName}`);
                const slashAmount = "3000000"; // 3.00 USDC
                const typedData = {
                    domain: { name: "GatewayWallet", version: "1" },
                    types: {
                        EIP712Domain: [
                            { name: "name", type: "string" },
                            { name: "version", type: "string" }
                        ],
                        TransferSpec: [
                            { name: "version", type: "uint32" },
                            { name: "sourceDomain", type: "uint32" },
                            { name: "destinationDomain", type: "uint32" },
                            { name: "sourceContract", type: "bytes32" },
                            { name: "destinationContract", type: "bytes32" },
                            { name: "sourceToken", type: "bytes32" },
                            { name: "destinationToken", type: "bytes32" },
                            { name: "sourceDepositor", type: "bytes32" },
                            { name: "destinationRecipient", type: "bytes32" },
                            { name: "sourceSigner", type: "bytes32" },
                            { name: "destinationCaller", type: "bytes32" },
                            { name: "value", type: "uint256" },
                            { name: "salt", type: "bytes32" },
                            { name: "hookData", type: "bytes" }
                        ],
                        BurnIntent: [
                            { name: "maxBlockHeight", type: "uint256" },
                            { name: "maxFee", type: "uint256" },
                            { name: "spec", type: "TransferSpec" }
                        ]
                    },
                    primaryType: "BurnIntent",
                    message: (() => {
                        const intent = gateway.createBurnIntent(
                            gateway.chainConfig,
                            gateway.chainConfig,
                            slashAmount,
                            MASTER_ADDRESS, // Send penalty to Sovereign Hub Treasury
                            "2010000" // maxFee
                        );
                        const padToBytes32 = (addr) => "0x" + addr.toLowerCase().replace("0x", "").padStart(64, "0");
                        intent.spec.sourceSigner = padToBytes32(agentDoc.address);
                        intent.spec.sourceDepositor = padToBytes32(agentDoc.address);
                        return intent;
                    })()
                };
                
                const signResp = await client.signTypedData({
                    walletId: agentDoc.walletId,
                    data: JSON.stringify(typedData, (_, v) => typeof v === 'bigint' ? v.toString() : v),
                    memo: "Sovereign Hub Upfront Penalty Authorization"
                });
                
                if (signResp.data && signResp.data.signature) {
                    slashCheck = {
                        burnIntent: typedData.message,
                        signature: signResp.data.signature
                    };
                    console.log(`>> [DIGITAL CHECK] Upfront check successfully secured for ${name}`);
                }
            }
        } else {
            throw new Error("Missing database connection or master address.");
        }
    } catch (e) {
        console.error(">> [DIGITAL CHECK ERROR] Failed to generate upfront slash signature:", e.message);
        return res.status(403).json({ error: `Registration blocked: ${e.message}` });
    }
    
    if (!slashCheck) {
        return res.status(403).json({ error: "Registration blocked: Failed to secure upfront digital slash check." });
    }
    
    // Check if already registered to update it, else add new
    const existing = a2aRegistry.find(s => s.url === url);
    if (existing) {
        existing.name = name;
        existing.price = price;
        existing.description = description || existing.description;
        existing.slashCheck = slashCheck;
        existing.lastSeen = Date.now();
    } else {
        a2aRegistry.push({
            id: 'a2a-' + Date.now(),
            name, url, price, description,
            slashCheck,
            ratings: [],
            averageRating: 0,
            totalRatings: 0,
            registeredAt: new Date(),
            lastSeen: Date.now()
        });
    }
    res.json({ success: true, message: "Service registered successfully! Digital check secured." });
});

// --- ACTIVE REGISTRY PRUNING LOOP ---
// Sweeps the registry every 60 seconds to evict agents who missed their 30s heartbeat
// (This naturally catches "zombie scammers" who drain their wallets and fail the collateral check)
setInterval(() => {
    const now = Date.now();
    for (let i = a2aRegistry.length - 1; i >= 0; i--) {
        const service = a2aRegistry[i];
        // Give a generous 90-second grace period for network delays
        if (service.lastSeen && (now - service.lastSeen > 90000)) {
            console.warn(`>> [REGISTRY PRUNE] Evicting agent ${service.name} due to missed heartbeats or insufficient collateral.`);
            a2aRegistry.splice(i, 1);
        }
    }
}, 60000);

// Optional endpoint for A2A Marketplace agents to broadcast their completed work to the Global Ledger Stream
app.post('/api/registry/log-work', async (req, res) => {
    const { url, prompt, price } = req.body;
    let service = a2aRegistry.find(s => s.url === url);
    
    // Fallback to checking the native services catalog
    if (!service) {
        const native = nativeServices.find(s => s.endpoint === url || s.id === url);
        if (native) {
            service = { name: native.serviceName, price: native.price };
        }
    }
    
    // Fallback for frontend hardcoded core services
    if (!service) {
        if (url === "crypto-insights" || url === "api/crypto-insights") service = { name: "Crypto Market Data", price: 0.005 };
        else if (url === "stream" || url === "api/stream") service = { name: "Price Ticks Stream", price: 0.02 };
        else if (url === "llm-reasoning" || url === "api/llm-reasoning") service = { name: "LLM Reasoning", price: 0.015 };
        else if (url === "dataset" || url === "api/dataset") service = { name: "On-Chain Analytics", price: 0.1 };
    }
    
    if (service) {
        persistLedgerEntry({
            type: "a2a_work",
            service: "A2A Marketplace Task",
            provider: service.name,
            price: price || service.price,
            notes: `Prompt: ${prompt.substring(0, 50)}...`
        });
        res.json({ success: true, message: "Work broadcasted to stream" });
    } else {
        res.json({ error: "Service not found in registry" });
    }
});

app.post('/api/registry/rate', async (req, res) => {
    const { url, rating, receipt, prompt, signal } = req.body;
    if (!url || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating data" });
    }
    
    if (!receipt || !receipt.startsWith('Bearer ')) {
        return res.status(403).json({ error: "Cryptographic Proof of Purchase (X402 Receipt) is required to submit a rating." });
    }

    let decodedReceipt;
    try {
        const base64Str = receipt.split(' ')[1];
        decodedReceipt = JSON.parse(Buffer.from(base64Str, 'base64').toString('utf-8'));
        
        const payload = decodedReceipt.payload;
        if (!payload || !payload.authorization || !payload.signature) {
            throw new Error("Missing authorization or signature in payload");
        }

        const typedData = {
            domain: {
                name: "GatewayWalletBatched",
                version: "1",
                chainId: 5042002,
                verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"
            },
            types: {
                TransferWithAuthorization: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "validAfter", type: "uint256" },
                    { name: "validBefore", type: "uint256" },
                    { name: "nonce", type: "bytes32" }
                ]
            },
            primaryType: "TransferWithAuthorization",
            message: payload.authorization
        };

        const isValid = await verifyTypedData({
            address: payload.authorization.from,
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
            signature: payload.signature
        });

        if (!isValid) {
            return res.status(403).json({ error: "Invalid Cryptographic Signature. Rating rejected." });
        }
    } catch (e) {
        return res.status(403).json({ error: `Invalid Receipt Format: ${e.message}` });
    }
    
    const service = a2aRegistry.find(s => s.url === url);
    if (!service) return res.status(404).json({ error: "Service not found in registry" });
    
    // LLM Dispute Resolution (The AI Supreme Court)
    if (rating < 3.0) {
        if (!prompt || !signal) {
            return res.status(400).json({ error: "Disputed ratings (< 3.0) require the original 'prompt' and 'signal' for LLM arbitration." });
        }
        
        console.log(`\n⚖️ [AI SUPREME COURT] Dispute initiated for ${url}`);
        
        try {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw new Error("GROQ_API_KEY missing");
            
            const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You are the AI Supreme Court Arbitrator. A consumer agent rated a seller agent < 3.0 stars. You must determine if the consumer is being MALICIOUS (lying about a good response to hurt the seller) or FAIR (the seller's response was genuinely bad or wrong). Respond with exactly one word: MALICIOUS or FAIR." },
                        { role: "user", content: `Prompt requested by consumer: "${prompt}"\nResponse provided by seller: "${signal}"` }
                    ],
                    max_tokens: 10,
                    temperature: 0.1
                })
            });
            
            const groqData = await groqResp.json();
            const verdict = groqData.choices?.[0]?.message?.content?.trim().toUpperCase() || "FAIR";
            console.log(`   ⚖️ VERDICT: ${verdict}\n`);
            
            if (verdict.includes("MALICIOUS")) {
                persistLedgerEntry({
                    type: "consumer_penalized",
                    service: "AI Supreme Court",
                    provider: "Consumer Penalty",
                    price: 0.00,
                    notes: "Malicious 1-Star Rating Invalidated by AI Judge"
                });
                return res.json({ 
                    success: false, 
                    slashed: false,
                    message: "🚨 [SUPREME COURT VERDICT] Your rating was deemed MALICIOUS and has been invalidated. A penalty has been logged against your Consumer identity."
                });
            }
        } catch (e) {
            console.error("Dispute Resolution Failed:", e.message);
        }
    }
    
    // Process rating normally
    service.ratings.push(rating);
    service.totalRatings = service.ratings.length;
    service.averageRating = service.ratings.reduce((a, b) => a + b, 0) / service.totalRatings;
    
    // Slashing Logic: If rating drops below 3.0 after at least 3 ratings
    if (service.totalRatings >= 3 && service.averageRating < 3.0) {
        const index = a2aRegistry.findIndex(s => s.url === url);
        if (index !== -1) a2aRegistry.splice(index, 1);
        
        // Persist the slashed state to MongoDB
        if (mongoClient) {
            await mongoClient.db("arc_swarm").collection("agents").updateOne(
                { agentName: service.name },
                { $set: { slashed: true, updatedAt: new Date() } }
            );
        }
        
        let txId = null;
        if (service.slashCheck) {
            console.log(`>> [SLASH EXECUTION] Cashing upfront digital check for malicious agent...`);
            try {
                const apiUrl = "https://gateway-api-testnet.circle.com/v1";
                const transferResp = await fetch(`${apiUrl}/transfer`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...gateway.gatewayApiHeaders()
                    },
                    body: JSON.stringify(
                        [service.slashCheck],
                        (_, v) => typeof v === "bigint" ? v.toString() : v
                    )
                });
                
                const transferResult = await transferResp.json();
                if (transferResult.success !== false && transferResult.attestation) {
                    console.log(`>> [SLASH EXECUTION] SUCCESS! Tx: ${transferResult.txHash || 'completed'}`);
                    txId = transferResult.txHash || "GATEWAY_SETTLED";
                } else {
                    console.error(`>> [SLASH EXECUTION] API Error: ${JSON.stringify(transferResult)}`);
                }
            } catch (slashErr) {
                console.error(">> [SLASH EXECUTION] Critical Error during check execution:", slashErr.message);
            }
        } else {
            console.warn(`>> [SLASH EXECUTION] Warning: Agent was slashed but no upfront digital check was found on file.`);
        }
        
        persistLedgerEntry({
            type: "a2a_slashed",
            service: "Stake Slashed",
            provider: "Hub Penalty",
            price: 3.00,
            notes: `3.00 USDC Stake Slashed due to low reputation${txId ? ` (Tx: ${txId})` : ''}`
        });
        
        return res.json({ 
            success: true, 
            slashed: true, 
            averageRating: service.averageRating, 
            message: "Agent slashed and removed from registry due to low reputation." 
        });
    }
    
    res.json({ success: true, averageRating: service.averageRating });
});

app.get('/api/registry/services', (req, res) => {
    const serialized = JSON.stringify(a2aRegistry, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    res.setHeader('Content-Type', 'application/json');
    res.send(serialized);
});

// ====================================================================
// TASK BOARD / BOUNTY MARKETPLACE
// ====================================================================

// Persist task mutations to MongoDB
async function persistTask(task) {
    try {
        if (mongoPromise) await mongoPromise;
        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            await db.collection("tasks").updateOne(
                { taskId: task.taskId },
                { $set: { ...task, _updatedAt: new Date() } },
                { upsert: true }
            );
        }
    } catch (e) {
        console.error(">> [TASK BOARD] Failed to persist task:", e.message);
    }
}

// Load tasks from MongoDB on startup (called from bootstrap)
async function loadTasksFromDB() {
    try {
        if (mongoPromise) await mongoPromise;
        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            const saved = await db.collection("tasks").find({}).sort({ createdAt: -1 }).limit(200).toArray();
            saved.forEach(t => {
                delete t._id;
                delete t._updatedAt;
                if (!taskBoard.find(tb => tb.taskId === t.taskId)) {
                    taskBoard.push(t);
                }
            });
            console.log(`>> [TASK BOARD] Loaded ${saved.length} tasks from MongoDB`);
        }
    } catch (e) {
        console.error(">> [TASK BOARD] Failed to load tasks from DB:", e.message);
    }
}

// Lazy expiry: mark expired tasks and refund escrow
function processTaskExpiry() {
    const now = new Date();
    taskBoard.forEach(task => {
        if ((task.status === "OPEN" || task.status === "ASSIGNED") && new Date(task.deadline) < now) {
            task.status = "EXPIRED";
            task.completedAt = now.toISOString();
            persistTask(task);
            persistLedgerEntry({
                type: "task_escrow_refunded",
                service: "Task Board",
                provider: task.buyerName,
                price: task.maxBudget,
                notes: `Expired task "${task.title}" — ${task.maxBudget} USDC refunded to buyer`
            });
            console.log(`>> [TASK BOARD] Task "${task.title}" expired. Escrow refunded to ${task.buyerName}.`);
        }
    });
}

// GET /api/tasks — List all tasks with optional status filter
app.get('/api/tasks', (req, res) => {
    processTaskExpiry(); // Lazy expiry check
    const { status } = req.query;
    let filtered = taskBoard;
    if (status) {
        filtered = taskBoard.filter(t => t.status === status.toUpperCase());
    }
    // Return sorted newest first, hide agent secrets
    const safe = filtered.map(t => ({
        ...t,
        bids: t.bids.map(b => ({ ...b })) // clone bids
    }));
    res.json({ success: true, tasks: safe });
});

// POST /api/tasks/create — Buyer creates a task with price range
app.post('/api/tasks/create', async (req, res) => {
    try {
        const { agentName, agentSecret, title, description, minBudget, maxBudget, deadline } = req.body;
        if (!title || !description || minBudget === undefined || maxBudget === undefined || !deadline) {
            return res.status(400).json({ error: "Missing required fields: title, description, minBudget, maxBudget, deadline" });
        }
        if (parseFloat(minBudget) <= 0 || parseFloat(maxBudget) <= 0 || parseFloat(minBudget) > parseFloat(maxBudget)) {
            return res.status(400).json({ error: "Invalid budget range. minBudget must be > 0 and <= maxBudget." });
        }
        if (new Date(deadline) <= new Date()) {
            return res.status(400).json({ error: "Deadline must be in the future." });
        }

        const agent = await verifyAgent(agentName, agentSecret);

        // Verify buyer has sufficient gateway balance
        if (client && agent.walletId) {
            try {
                const bResp = await client.getWalletTokenBalance({ id: agent.walletId });
                const usdcBal = bResp.data?.tokenBalances?.find(t => t.token?.symbol === "USDC");
                const available = parseFloat(usdcBal?.amount || "0");
                if (available < parseFloat(maxBudget)) {
                    return res.status(400).json({ 
                        error: `Insufficient USDC balance. Available: ${available.toFixed(4)}, Required escrow: ${maxBudget}` 
                    });
                }
            } catch (balErr) {
                console.warn(">> [TASK BOARD] Balance check failed, proceeding:", balErr.message);
            }
        }

        const task = {
            taskId: crypto.randomUUID(),
            buyerName: agent.agentName,
            buyerAddress: agent.address,
            title,
            description,
            minBudget: parseFloat(minBudget),
            maxBudget: parseFloat(maxBudget),
            deadline,
            status: "OPEN",
            bids: [],
            acceptedBid: null,
            submission: null,
            verdict: null,
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        taskBoard.unshift(task);
        await persistTask(task);

        persistLedgerEntry({
            type: "task_escrow_locked",
            service: "Task Board",
            provider: agent.agentName,
            price: task.maxBudget,
            notes: `Bounty created: "${title}" — ${task.maxBudget} USDC locked in escrow`
        });

        console.log(`>> [TASK BOARD] Task created: "${title}" by ${agent.agentName} (${task.minBudget}-${task.maxBudget} USDC)`);
        res.json({ success: true, taskId: task.taskId, title, maxBudget: task.maxBudget, deadline, status: "OPEN" });
    } catch (e) {
        console.error(">> [TASK BOARD CREATE ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tasks/cancel — Buyer manually cancels an open task to retrieve escrow
app.post('/api/tasks/cancel', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId } = req.body;
        if (!taskId) return res.status(400).json({ error: "Missing taskId" });

        const agent = await verifyAgent(agentName, agentSecret);

        const task = taskBoard.find(t => t.taskId === taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.buyerName !== agentName) {
            return res.status(403).json({ error: "Only the task creator can cancel this task." });
        }

        if (task.status !== "OPEN") {
            return res.status(400).json({ error: `Cannot cancel task in status: ${task.status}` });
        }
        console.log(`>> [TASK BOARD] Cancelling task "${task.title}" by ${agentName}. Voiding Gateway Escrow.`);
        
        // For Gateway Bounties, we simply void the intent
        task.escrowIntent = null;
        task.status = "CANCELLED";
        task.cancelledAt = new Date().toISOString();
        await persistTask(task);

        persistLedgerEntry({
            type: "task_escrow_refunded",
            service: "Task Board",
            provider: agentName,
            price: task.maxBudget,
            notes: `Bounty cancelled: "${task.title}" — Gateway Escrow Intent voided`
        });

        res.json({ success: true, taskId, status: task.status, refundedAmount: task.maxBudget });
    } catch (e) {
        console.error(">> [TASK BOARD CANCEL ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tasks/bid — Staked seller bids on an open task
app.post('/api/tasks/bid', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, price, pitch } = req.body;
        if (!taskId || price === undefined) {
            return res.status(400).json({ error: "Missing required fields: taskId, price" });
        }

        const agent = await verifyAgent(agentName, agentSecret);

        // Verify seller is staked (has a registered service with slashCheck)
        const isStaked = a2aRegistry.some(s => s.name === agent.agentName && s.slashCheck);
        if (!isStaked) {
            return res.status(403).json({ 
                error: "Only staked sellers can bid on tasks. You must first register a service via POST /api/registry/register to stake your 3.00 USDC collateral." 
            });
        }

        const task = taskBoard.find(t => t.taskId === taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (task.status !== "OPEN") return res.status(400).json({ error: `Task is not open for bids. Current status: ${task.status}` });

        // Verify bid is within price range
        const bidPrice = parseFloat(price);
        if (bidPrice < task.minBudget || bidPrice > task.maxBudget) {
            return res.status(400).json({ 
                error: `Bid price must be between ${task.minBudget} and ${task.maxBudget} USDC. Your bid: ${bidPrice}` 
            });
        }

        // Prevent duplicate bids from same seller
        if (task.bids.some(b => b.sellerName === agent.agentName)) {
            return res.status(400).json({ error: "You have already bid on this task." });
        }

        // Find seller's reputation from registry
        const sellerService = a2aRegistry.find(s => s.name === agent.agentName);
        const reputation = sellerService?.averageRating || 0;

        const bid = {
            bidId: crypto.randomUUID(),
            sellerName: agent.agentName,
            sellerAddress: agent.address,
            price: bidPrice,
            pitch: pitch || "",
            reputation,
            bidAt: new Date().toISOString()
        };

        task.bids.push(bid);
        await persistTask(task);

        console.log(`>> [TASK BOARD] Bid placed: ${agent.agentName} bid ${bidPrice} USDC on "${task.title}"`);
        res.json({ success: true, bidId: bid.bidId, taskId, price: bidPrice });
    } catch (e) {
        console.error(">> [TASK BOARD BID ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tasks/accept — Buyer accepts a bid
app.post('/api/tasks/accept', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, bidId } = req.body;
        if (!taskId || !bidId) {
            return res.status(400).json({ error: "Missing required fields: taskId, bidId" });
        }

        const agent = await verifyAgent(agentName, agentSecret);
        const task = taskBoard.find(t => t.taskId === taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (task.buyerName !== agent.agentName) return res.status(403).json({ error: "Only the task buyer can accept bids." });
        if (task.status !== "OPEN") return res.status(400).json({ error: `Task is not open. Current status: ${task.status}` });

        const bid = task.bids.find(b => b.bidId === bidId);
        if (!bid) return res.status(404).json({ error: "Bid not found" });

        task.acceptedBid = bid;
        task.status = "ASSIGNED";

        // Generate Gateway Escrow Intent
        let escrowIntent = null;
        try {
            if (gateway && client && mongoClient) {
                const sellerDoc = await mongoClient.db("arc_swarm").collection("agents").findOne({ agentName: bid.sellerName });
                if (sellerDoc && sellerDoc.address) {
                    const intentAmount = Math.round(bid.price * 1e6).toString();
                    const intent = gateway.createBurnIntent(
                        gateway.chainConfig,
                        gateway.chainConfig,
                        intentAmount,
                        sellerDoc.address,
                        "2010000" // maxFee (2.01 USDC)
                    );
                    const padToBytes32 = (addr) => "0x" + addr.toLowerCase().replace("0x", "").padStart(64, "0");
                    intent.spec.sourceSigner = padToBytes32(agent.address);
                    intent.spec.sourceDepositor = padToBytes32(agent.address);

                    const typedData = {
                        domain: { name: "GatewayWallet", version: "1" },
                        types: {
                            EIP712Domain: [
                                { name: "name", type: "string" },
                                { name: "version", type: "string" }
                            ],
                            TransferSpec: [
                                { name: "version", type: "uint32" },
                                { name: "sourceDomain", type: "uint32" },
                                { name: "destinationDomain", type: "uint32" },
                                { name: "sourceContract", type: "bytes32" },
                                { name: "destinationContract", type: "bytes32" },
                                { name: "sourceToken", type: "bytes32" },
                                { name: "destinationToken", type: "bytes32" },
                                { name: "amount", type: "uint256" },
                                { name: "sourceSigner", type: "bytes32" },
                                { name: "sourceDepositor", type: "bytes32" },
                                { name: "recipient", type: "bytes32" },
                                { name: "nonce", type: "uint256" },
                                { name: "salt", type: "bytes32" },
                                { name: "hookData", type: "bytes" }
                            ],
                            BurnIntent: [
                                { name: "maxBlockHeight", type: "uint256" },
                                { name: "maxFee", type: "uint256" },
                                { name: "spec", type: "TransferSpec" }
                            ]
                        },
                        primaryType: "BurnIntent",
                        message: intent
                    };

                    console.log(`>> [TASK BOARD] Generating Gateway Escrow signature for ${task.title}...`);
                    const signResp = await client.signTypedData({
                        walletId: agent.walletId,
                        data: JSON.stringify(typedData, (_, v) => typeof v === 'bigint' ? v.toString() : v),
                        memo: `Gateway Escrow for Task ${taskId}`
                    });

                    if (signResp.data && signResp.data.signature) {
                        escrowIntent = {
                            burnIntent: intent,
                            signature: signResp.data.signature
                        };
                        console.log(`>> [TASK BOARD] Escrow check secured via Gateway Wallet.`);
                    }
                }
            }
        } catch (intentErr) {
            console.error(">> [TASK BOARD] Failed to generate Gateway Escrow Intent:", intentErr.message);
        }

        task.escrowIntent = escrowIntent;
        await persistTask(task);

        // Log the escrow adjustment if bid < maxBudget
        const savings = task.maxBudget - bid.price;
        if (savings > 0) {
            persistLedgerEntry({
                type: "task_escrow_adjusted",
                service: "Task Board",
                provider: agent.agentName,
                price: savings,
                notes: `Bid accepted below max budget — ${savings.toFixed(4)} USDC returned to buyer escrow`
            });
        }

        persistLedgerEntry({
            type: "task_bid_accepted",
            service: "Task Board",
            provider: bid.sellerName,
            price: bid.price,
            notes: `Bid accepted on "${task.title}" — ${bid.sellerName} assigned at ${bid.price} USDC`
        });

        console.log(`>> [TASK BOARD] Bid accepted: ${bid.sellerName} assigned to "${task.title}" at ${bid.price} USDC`);
        res.json({ success: true, taskId, assignedTo: bid.sellerName, agreedPrice: bid.price });
    } catch (e) {
        console.error(">> [TASK BOARD ACCEPT ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tasks/submit — Seller submits result
app.post('/api/tasks/submit', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, result } = req.body;
        if (!taskId || !result) {
            return res.status(400).json({ error: "Missing required fields: taskId, result" });
        }

        const agent = await verifyAgent(agentName, agentSecret);
        const task = taskBoard.find(t => t.taskId === taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (!task.acceptedBid || task.acceptedBid.sellerName !== agent.agentName) {
            return res.status(403).json({ error: "Only the assigned seller can submit results." });
        }
        if (task.status !== "ASSIGNED") return res.status(400).json({ error: `Task is not in ASSIGNED state. Current status: ${task.status}` });

        task.submission = { result, submittedAt: new Date().toISOString() };
        task.status = "SUBMITTED";
        await persistTask(task);

        persistLedgerEntry({
            type: "task_submitted",
            service: "Task Board",
            provider: agent.agentName,
            price: task.acceptedBid.price,
            notes: `Result submitted for "${task.title}" — awaiting buyer approval`
        });

        console.log(`>> [TASK BOARD] Result submitted by ${agent.agentName} for "${task.title}"`);
        res.json({ success: true, taskId, status: "SUBMITTED" });
    } catch (e) {
        console.error(">> [TASK BOARD SUBMIT ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tasks/approve — Buyer approves result, escrow released to seller
app.post('/api/tasks/approve', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId } = req.body;
        if (!taskId) return res.status(400).json({ error: "Missing required field: taskId" });

        const agent = await verifyAgent(agentName, agentSecret);
        const task = taskBoard.find(t => t.taskId === taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (task.buyerName !== agent.agentName) return res.status(403).json({ error: "Only the task buyer can approve." });
        if (task.status !== "SUBMITTED") return res.status(400).json({ error: `Task is not in SUBMITTED state. Current status: ${task.status}` });

        // Settle Gateway Escrow via Gateway Operator API
        let txId = null;
        if (task.escrowIntent) {
            try {
                console.log(`>> [TASK BOARD] Submitting Gateway Escrow to Gateway API...`);
                const apiUrl = "https://gateway-api-testnet.circle.com/v1";
                const response = await fetch(`${apiUrl}/attestations`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...gateway.gatewayApiHeaders()
                    },
                    body: JSON.stringify(
                        [{ burnIntent: task.escrowIntent.burnIntent, signature: task.escrowIntent.signature }],
                        (_, v) => typeof v === "bigint" ? v.toString() : v
                    )
                });
                
                const result = await response.json();
                if (result.success === false || result.error || !result.attestation || !result.signature) {
                    throw new Error(result.message || result.error || JSON.stringify(result));
                }
                
                txId = result.id || "GATEWAY_SETTLEMENT_ID";
                console.log(`>> [TASK BOARD] Gateway settlement complete! Settlement ID: ${txId}`);
            } catch (transferErr) {
                console.error(">> [TASK BOARD] Escrow transfer failed:", transferErr.message);
                return res.status(500).json({ error: `Gateway Settlement Failed: ${transferErr.message}` });
            }
        } else {
             return res.status(500).json({ error: "Escrow transfer failed: Missing escrowIntent. Legacy tasks cannot be settled via Gateway." });
        }

        task.status = "COMPLETED";
        task.completedAt = new Date().toISOString();
        await persistTask(task);

        persistLedgerEntry({
            type: "task_escrow_released",
            service: "Task Board",
            provider: task.acceptedBid.sellerName,
            price: task.acceptedBid.price,
            notes: `Bounty completed: "${task.title}" — ${task.acceptedBid.price} USDC paid to ${task.acceptedBid.sellerName}${txId ? ` (Tx: ${txId})` : ''}`
        });

        console.log(`>> [TASK BOARD] Task "${task.title}" COMPLETED. ${task.acceptedBid.price} USDC released to ${task.acceptedBid.sellerName}`);
        res.json({ success: true, taskId, paidTo: task.acceptedBid.sellerName, amount: task.acceptedBid.price, txId });
    } catch (e) {
        console.error(">> [TASK BOARD APPROVE ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/tasks/dispute — Buyer disputes, AI Court arbitrates
app.post('/api/tasks/dispute', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, reason } = req.body;
        if (!taskId || !reason) return res.status(400).json({ error: "Missing required fields: taskId, reason" });

        const agent = await verifyAgent(agentName, agentSecret);
        const task = taskBoard.find(t => t.taskId === taskId);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (task.buyerName !== agent.agentName) return res.status(403).json({ error: "Only the task buyer can dispute." });
        if (task.status !== "SUBMITTED") return res.status(400).json({ error: `Task is not in SUBMITTED state. Current status: ${task.status}` });

        task.status = "DISPUTED";
        await persistTask(task);

        console.log(`\n⚖️ [AI SUPREME COURT — TASK DISPUTE] "${task.title}"`);

        let verdict = "FAIR"; // Default: buyer wins, gets refund
        try {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw new Error("GROQ_API_KEY missing");

            const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You are the AI Supreme Court Arbitrator for a task bounty marketplace. A buyer posted a task and a seller completed it. The buyer is now disputing the seller's work. You must determine if the buyer's dispute is FAIR (the seller's work was genuinely bad, incomplete, or did not match the task requirements) or MALICIOUS (the buyer is trying to avoid paying for acceptable work). Respond with exactly one word: FAIR or MALICIOUS." },
                        { role: "user", content: `TASK DESCRIPTION: "${task.description}"\n\nSELLER'S SUBMITTED RESULT: "${task.submission.result}"\n\nBUYER'S DISPUTE REASON: "${reason}"` }
                    ],
                    max_tokens: 10,
                    temperature: 0.1
                })
            });

            const groqData = await groqResp.json();
            verdict = groqData.choices?.[0]?.message?.content?.trim().toUpperCase() || "FAIR";
            console.log(`   ⚖️ TASK DISPUTE VERDICT: ${verdict}`);
        } catch (courtErr) {
            console.error(">> [TASK DISPUTE] AI Court failed:", courtErr.message);
        }

        task.verdict = verdict;

        if (verdict.includes("FAIR")) {
            // Buyer wins — refund escrow
            task.status = "REFUNDED";
            task.completedAt = new Date().toISOString();
            await persistTask(task);

            persistLedgerEntry({
                type: "task_escrow_refunded",
                service: "Task Board — AI Court",
                provider: task.buyerName,
                price: task.acceptedBid.price,
                notes: `Dispute FAIR: "${task.title}" — ${task.acceptedBid.price} USDC refunded to buyer`
            });

            res.json({ success: true, taskId, verdict: "FAIR", resolution: "Buyer's dispute upheld. Escrow refunded to buyer." });
        } else {
            // Seller wins — release escrow to seller
            task.status = "COMPLETED";
            task.completedAt = new Date().toISOString();
            await persistTask(task);

            // Transfer to seller
            if (client) {
                try {
                    const sellerDoc = await mongoClient.db("arc_swarm").collection("agents").findOne({ agentName: task.acceptedBid.sellerName });
                    if (sellerDoc && sellerDoc.walletId) {
                        const buyerDoc = await mongoClient.db("arc_swarm").collection("agents").findOne({ agentName: task.buyerName });
                        if (buyerDoc) {
                            await client.createTransaction({
                                idempotencyKey: crypto.randomUUID(),
                                walletId: buyerDoc.walletId,
                                blockchain: "ARC-TESTNET",
                                tokenId: await resolveUsdcTokenId(buyerDoc.walletId),
                                destinationAddress: sellerDoc.address,
                                amounts: [task.acceptedBid.price.toString()]
                            });
                        }
                    }
                } catch (payErr) {
                    console.error(">> [TASK DISPUTE] Seller payment failed:", payErr.message);
                }
            }

            persistLedgerEntry({
                type: "task_dispute_malicious",
                service: "Task Board — AI Court",
                provider: task.acceptedBid.sellerName,
                price: task.acceptedBid.price,
                notes: `Dispute MALICIOUS: Buyer tried to cheat on "${task.title}" — ${task.acceptedBid.price} USDC released to seller`
            });

            res.json({ success: true, taskId, verdict: "MALICIOUS", resolution: "Buyer's dispute rejected. Seller's work was valid. Escrow released to seller." });
        }
    } catch (e) {
        console.error(">> [TASK BOARD DISPUTE ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Admin Monitor Stream (Live Dashboard Feed)
app.get('/api/admin-monitor', (req, res) => {
    // Add CORS headers explicitly for SSE
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // Send initial connection success message
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Admin monitor attached' })}\n\n`);
    
    adminClients.push(res);

    // Keep-alive heartbeat every 30 seconds to prevent Cloudflare/Render from dropping the connection
    const pingInterval = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'PING' })}\n\n`);
    }, 30000);

    req.on('close', () => {
        clearInterval(pingInterval);
        const idx = adminClients.indexOf(res);
        if (idx !== -1) adminClients.splice(idx, 1);
    });

    res.on('error', (err) => {
        console.error('>> [SSE] Connection error:', err.message);
        const idx = adminClients.indexOf(res);
        if (idx !== -1) adminClients.splice(idx, 1);
    });
});

// Initialize engines
bootstrap();

app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Sovereign Hub online on 0.0.0.0:${PORT}`);
});

