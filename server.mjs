import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import axios from 'axios';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { SwarmOrchestrator } from './arc-sdk/src/SwarmOrchestrator.js';

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
let orchestrator = null;
const nanoLedger = []; // Global in-memory swarm ledger
const adminClients = []; // SSE connections
const a2aRegistry = []; // A2A Marketplace registry

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
        
        // Initialize Modular Orchestrator
        orchestrator = new SwarmOrchestrator({
            apiKey: API_KEY,
            entitySecret: ENTITY_SECRET,
            privateKey: process.env.CIRCLE_GATEWAY_PRIVATE_KEY,
            gatewayAddress: process.env.CIRCLE_GATEWAY_ADDRESS || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
            treasuryAddress: MASTER_WALLET_ID
        });

        console.log(">> [SENTINEL] Swarm Engines Operational (Modular Mode).");

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
        
        if (orchestrator) orchestrator.setGateway(gateway);
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
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const txCheck = await client.getTransaction({ id: approveTxId });
                approveState = txCheck.data?.transaction?.state || "UNKNOWN";
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
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const txCheck = await client.getTransaction({ id: depositTxId });
                depositState = txCheck.data?.transaction?.state || "UNKNOWN";
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
            depositTxId, 
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
                txId = txResp?.data?.id;
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

app.post('/agent/sign-402', async (req, res) => {
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

// Register a service
app.post('/api/registry/register', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("3.00")(req, res, next);
    },
    (req, res) => {
    const { name, url, price, description } = req.body;
    if (!name || !url || price === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Check if already registered to update it, else add new
    const existing = a2aRegistry.find(s => s.url === url);
    if (existing) {
        existing.name = name;
        existing.price = price;
        existing.description = description || existing.description;
    } else {
        a2aRegistry.push({
            id: 'a2a-' + Date.now(),
            name, url, price, description,
            ratings: [],
            averageRating: 0,
            totalRatings: 0,
            registeredAt: new Date()
        });
    }
    res.json({ success: true, message: "Service registered successfully!" });
});

app.post('/api/registry/rate', async (req, res) => {
    const { url, rating, receipt, prompt, signal } = req.body;
    if (!url || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating data" });
    }
    
    if (!receipt || !receipt.startsWith('Bearer ')) {
        return res.status(403).json({ error: "Cryptographic Proof of Purchase (X402 Receipt) is required to submit a rating." });
    }
    
    const service = a2aRegistry.find(s => s.url === url);
    if (!service) return res.status(404).json({ error: "Service not found in registry" });
    
    // LLM Dispute Resolution (The AI Supreme Court)
    if (rating < 3.0) {
        if (!prompt || !signal) {
            return res.status(400).json({ error: "Disputed ratings (< 3.0) require the original 'prompt' and 'signal' for LLM arbitration." });
        }
        
        console.log(`\n⚖️ [AI SUPREME COURT] Dispute initiated for ${url}`);
        console.log(`   📝 Prompt: "${prompt}"`);
        console.log(`   🤖 Signal: "${signal}"`);
        
        try {
            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) throw new Error("GROQ_API_KEY missing");
            
            const judgePrompt = `You are an impartial AI Judge in an Agent-to-Agent economy. 
A Consumer Agent paid a Producer Agent to answer the following prompt:
"${prompt}"

The Producer Agent returned the following signal/answer:
"${signal}"

The Consumer Agent gave this a terrible rating (${rating} out of 5 stars) and is trying to slash the Producer.
Is this a fair rating (the signal is garbage/unrelated), or is the Consumer being MALICIOUS (the signal is actually a good, high-quality answer)?
Reply with EXACTLY ONE WORD: either "FAIR" or "MALICIOUS".`;

            const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: judgePrompt }],
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
        
        persistLedgerEntry({
            type: "a2a_slashed",
            service: "Stake Slashed",
            provider: "Hub Penalty",
            price: 3.00,
            notes: "3.00 USDC Stake Slashed due to low reputation"
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
    res.json(a2aRegistry);
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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Sovereign Hub online on 0.0.0.0:${PORT}`);
});

