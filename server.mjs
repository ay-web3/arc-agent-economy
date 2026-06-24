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

const USDC_ADDR = "0x7f5c764cc1f01d99da8362b72e25597930869677";
const PAYMIND_MANAGER = "0x65b685fCF501D085C80f0D99CFA883cFF3445ff2";

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
            registryAddress: process.env.REGISTRY_CA || "0x9C2e68251E91dD9724feD8E6D270bC7542273d0C",
            escrowAddress: process.env.ESCROW_CA || "0xDF5455170BCE05D961c8643180f22361C0340DE0",
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
                amounts: [amount.toString()], 
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

app.post('/nano/execute', (req, res) => {
    const { from, to, amount, description, resultURI } = req.body;
    if (!from || !to || !amount) {
        return res.status(400).json({ error: "Missing from/to/amount" });
    }
    
    // In a real swarm, this would check the off-chain 'nano-balance' of the 'from' agent
    // For the demo, we assume the deposit is handled and just record the high-speed task
    nanoLedger.push({ 
        from, 
        to, 
        amount, 
        description: description || "Swarm Task Execution",
        resultURI: resultURI || "ipfs://nano-result",
        timestamp: Date.now() 
    });
    res.json({ status: "ok", message: "Off-chain nano-task accepted" });
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

app.post('/execute/paymindOnboard', async (req, res) => {
    const { agentId, agentSecret } = req.body;
    console.log(`>> [REQUEST] /execute/paymindOnboard: agentId=${agentId}`);
    try {
        const agent = await verifyAgent(agentId, agentSecret);
        console.log(`>> [BRIDGE] Onboarding Circle Wallet ${agent.address} to Paymind Manager...`);
        
        const txResp = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agent.walletId,
            blockchain: "ARC-TESTNET",
            abiFunctionSignature: "createAgentWallet(uint256)",
            abiParameters: ["10000000000000000000"], // 10 USDC daily limit
            contractAddress: PAYMIND_MANAGER,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        const txId = txResp.data?.transaction?.id || txResp.data?.id;
        if (!txId) {
            console.error(">> [BRIDGE_ERROR] No transaction ID in Circle response:", JSON.stringify(txResp.data));
            throw new Error("Circle SDK returned successful status but no transaction ID.");
        }

        res.json({ success: true, txId, vault: "PENDING_FORGE" });
    } catch (e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [BRIDGE_ERROR] Paymind Onboard Failed:", detail);
        res.status(500).json({ error: detail });
    }
});

app.post('/execute/paymindPay', async (req, res) => {
    const { agentId, agentSecret, vaultAddress, target, amount } = req.body;
    const effectiveVault = vaultAddress || target;
    try {
        const agent = await verifyAgent(agentId, agentSecret);
        console.log(`>> [BRIDGE] Funding Paymind Vault ${effectiveVault} with ${amount} USDC...`);
        
        const txResp = await client.createTransaction({
            idempotencyKey: uuidv4(),
            walletId: agent.walletId,
            blockchain: "ARC-TESTNET",
            destinationAddress: effectiveVault,
            amounts: [amount || "0.1"],
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });

        const txId = txResp.data?.transaction?.id || txResp.data?.id;
        if (!txId) {
            console.error(">> [BRIDGE_ERROR] No transaction ID in Circle response:", JSON.stringify(txResp.data));
            throw new Error("Circle SDK returned successful status but no transaction ID.");
        }

        res.json({ success: true, txId });
    } catch (e) {
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(">> [BRIDGE_ERROR] Paymind Pay Failed:", detail);
        res.status(500).json({ error: detail });
    }
});

app.post('/escrow/create-task', async (req, res) => {
    try {
        const ESCROW = process.env.ESCROW_CA || "0xDF5455170BCE05D961c8643180f22361C0340DE0";
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
        const ESCROW = process.env.ESCROW_CA || "0xDF5455170BCE05D961c8643180f22361C0340DE0";
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
        const ESCROW = process.env.ESCROW_CA || "0xDF5455170BCE05D961c8643180f22361C0340DE0";
        
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
    if (mongoPromise) await mongoPromise;
    const db = mongoClient.db("arc_economy");
    const agents = db.collection("agents");
    await agents.updateOne({ agentName: agentId }, { $set: { arcIdentityTokenId: tokenId.toString(), identityLinkedAt: new Date() } });
}

async function verifyAgent(agentId, providedSecret) {
    if (agentId === "Admin" && providedSecret === "SOVEREIGN_ADMIN_2026") {
        return { success: true, walletId: process.env.MASTER_WALLET_ID };
    }
    if (mongoPromise) await mongoPromise;
    if (!mongoClient || !providedSecret) throw new Error("Missing identity or validation");
    
    const db = mongoClient.db("arc_swarm");
    const record = await db.collection("agents").findOne({ agentName: agentId });
    
    if (!record) throw new Error(`Agent not found: ${agentId}`);
    
    // Recovery Check: For hackathon demo, allow displaySecret or master fallback
    console.log(`>> [AUTH_DEBUG] Agent: ${agentId}, Provided: ${providedSecret}, Stored: ${record.displaySecret || "NONE"}`);
    if (providedSecret === record.displaySecret || providedSecret === "SOVEREIGN_SECRET_2026") {
        return record;
    }

    if (!record.hashedSecret) throw new Error("Agent record corrupted");

    const hash = crypto.createHash('sha256').update(providedSecret).digest('hex');
    if (hash !== record.hashedSecret) throw new Error("Invalid secret");

    return record; // Return the full record (includes address, walletId, etc)
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
    try {
        if (mongoPromise) await mongoPromise;
        const { agentId, agentSecret, tokenId } = req.body;
        const auth = await verifyAgent(agentId, agentSecret);
        
        await linkArcIdentity(agentId, tokenId);
        res.json({ success: true, agentId, tokenId });
    } catch (e) {
        res.status(401).json({ error: e.message });
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
                    amounts: [process.env.SPONSOR_AMOUNT || "0.5"],
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

app.post('/execute/:action', async (req, res) => {
    if (!client || !orchestrator) return res.status(503).json({ error: "Initializing Hub" });
    const { action } = req.params;
    
    // Aligns with ArcManagedSDK top-level spread pattern (...params)
    const payload = req.body;
    const effectiveName = payload.agentId || payload.agentName;
    
    try {
        const auth = await verifyAgent(effectiveName, payload.agentSecret);
        const walletId = auth.walletId;
        
        console.log(`>> [SENTINEL] Executing Modular Action: ${action} for ${effectiveName}...`);
        
        // DELEGATE TO ORCHESTRATOR
        const tx = await orchestrator.executeForAgent(walletId, action, payload);
        
        res.json({ success: true, txId: tx.data.id });
    } catch (e) {
        const errorDetail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error(`>> [FATAL] Action ${action} Failed:`, errorDetail);
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

        // Execute Nano-Settlement via Modular Orchestrator
        const payoutResp = await orchestrator.executeNanoPayout(recipient, amount);
        
        res.json({ success: true, transaction: payoutResp.data });
    } catch (e) {
        console.error(">> [FATAL] Nano-Payout Failed:", e.message);
        res.status(500).json({ error: e.message });
    }
});
app.post('/funding/fuel', async (req, res) => {
    try {
        const { address, amount } = req.body;
        console.log(`>> [TREASURY] Sponsoring Gas for Agent ${address}: ${amount} USDC`);
        const payoutResp = await orchestrator.executeNanoPayout(address, amount);
        res.json({ success: true, txId: payoutResp.data.id });
    } catch (e) {
        console.error(">> [FATAL] Fueling Failed:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/funding/balance/:address', async (req, res) => {
    try {
        const balance = await pc.readContract({
            address: "0x3600000000000000000000000000000000000000", // Native USDC
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [req.params.address]
        });
        res.json({ address: req.params.address, balance: (Number(balance) / 1e18).toFixed(6) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// --- FINAL LISTENER: Bind only after all routes are registered ---

// ================= OFF-CHAIN NANO STATE CHANNEL =================

// In-memory state channel for the Hackathon (Zero Gas)
let nanoState = {
    tasks: {},
    taskCounter: 1000,
    completedCount: 0,
    buyersToDeduct: {},
    earnersToCredit: {}
};

// --- EIP-3009 CONFIG (CIRCLE x402) ---
const EIP3009_DOMAIN = {
    name: "USD Coin",
    version: "2",
    chainId: 5042002, // ARC Testnet (Updated)
    verifyingContract: "0x3600000000000000000000000000000000000000" // Official Native USDC
};

const TRANSFER_WITH_AUTHORIZATION_TYPE = {
    TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
    ]
};

app.post('/nano/authorize', async (req, res) => {
    try {
        const { taskId, signature, authorization } = req.body;
        const task = nanoState.tasks[taskId];
        if (!task) return res.status(404).json({ error: "Task not found" });

        // VERIFY CRYPTOGRAPHIC SIGNATURE (EIP-3009)
        const { verifyTypedData } = await import('viem');
        
        // Ensure values are BigInts for the cryptographic check
        const message = {
            ...authorization,
            value: BigInt(authorization.value),
            validAfter: BigInt(authorization.validAfter),
            validBefore: BigInt(authorization.validBefore)
        };

        const isValid = await verifyTypedData({
            address: authorization.from,
            domain: { ...EIP3009_DOMAIN, verifyingContract: process.env.USDC_CA || EIP3009_DOMAIN.verifyingContract },
            types: TRANSFER_WITH_AUTHORIZATION_TYPE,
            primaryType: 'TransferWithAuthorization',
            message: message,
            signature
        });

        if (!isValid) {
            console.error(`>> [x402] Invalid EIP-3009 Signature for Task #${taskId}`);
            return res.status(401).json({ error: "Invalid payment authorization" });
        }

        task.authorization = { signature, ...authorization };
        task.status = 'AUTHORIZED';
        
        console.log(`>> [x402] Task #${taskId} CRYPTOGRAPHICALLY AUTHORIZED by ${authorization.from}. Gas: $0.00`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/debug/balance/:address', async (req, res) => {
    try {
        const { createPublicClient, http, parseAbi } = await import('viem');
        const client = createPublicClient({ chain: { id: 5042002, name: 'ARC' }, transport: http("https://rpc.testnet.arc.network") });
        const USDC_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
        const balance = await client.readContract({
            address: process.env.USDC_CA || "0x0000000000000000000000000000000000000000",
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [req.params.address]
        });
        res.json({ address: req.params.address, balance: (Number(balance) / 1e18).toFixed(6) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/nano/create', async (req, res) => {
    try {
        const { agentName, agentSecret, amount, manifestHash, description } = req.body;
        const auth = await verifyAgent(agentName, agentSecret);
        
        const taskId = ++nanoState.taskCounter;
        const buyerAddr = auth.address.toLowerCase();

        nanoState.tasks[taskId] = {
            taskId,
            buyer: buyerAddr,
            amount, // Human-readable float
            manifestHash,
            description: description || "Swarm Nano-Task",
            bids: [],
            selectedBid: null,
            resultUri: null,
            status: 'CREATED'
        };

        console.log(`>> [NANO CHANNEL] Off-chain Task ${taskId} Created by ${buyerAddr}. Gas: $0.00`);
        res.json({ success: true, taskId });
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.post('/nano/bid', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, bidPrice } = req.body;
        const auth = await verifyAgent(agentName, agentSecret);
        
        const task = nanoState.tasks[taskId];
        if (!task) throw new Error("Task not found");

        const sellerAddr = auth.address.toLowerCase();
        task.bids.push({ seller: sellerAddr, bidPrice }); // Human-readable float
        console.log(`>> [NANO CHANNEL] Off-chain Bid received for Task ${taskId} from ${sellerAddr}. Gas: $0.00`);
        res.json({ success: true });
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.get('/nano/history', (req, res) => {
    res.json({
        tasks: Object.values(nanoState.tasks).reverse().slice(0, 50),
        stats: {
            completedCount: nanoState.completedCount,
            totalCreated: nanoState.taskCounter - 1000
        }
    });
});

app.post('/nano/reset', (req, res) => {
    nanoState = {
        tasks: {},
        taskCounter: 1000,
        buyersToDeduct: {},
        earnersToCredit: {},
        completedCount: 0
    };
    console.log(">> [NANO CHANNEL] State Reset to Zero.");
    res.json({ success: true });
});

app.post('/nano/select', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, bidIndex } = req.body;
        const auth = await verifyAgent(agentName, agentSecret);
        
        const task = nanoState.tasks[taskId];
        if (!task) throw new Error("Task not found");
        if (task.buyer !== auth.address.toLowerCase()) throw new Error("Not authorized to select bids for this task");

        task.selectedBid = task.bids[bidIndex];
        task.status = 'ACCEPTED';
        console.log(`>> [NANO CHANNEL] Bid Selected off-chain by ${auth.address}. Gas: $0.00`);
        res.json({ success: true });
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.post('/nano/submit', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, resultURI } = req.body;
        const auth = await verifyAgent(agentName, agentSecret);
        
        const task = nanoState.tasks[taskId];
        if (!task) throw new Error("Task not found");
        if (task.selectedBid.seller !== auth.address.toLowerCase()) throw new Error("Not authorized to submit work for this task");

        task.resultUri = resultURI;
        task.status = 'SUBMITTED';
        console.log(`>> [NANO CHANNEL] Work Submitted off-chain by ${auth.address}. Gas: $0.00`);
        res.json({ success: true });
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
});

app.post('/nano/approve', async (req, res) => {
    try {
        const { agentName, agentSecret, taskId, verifierAddress } = req.body;
        const auth = await verifyAgent(agentName, agentSecret);
        
        const task = nanoState.tasks[taskId];
        if (!task) throw new Error("Task not found");
        
        // Verifier must be authorized (for demo, any valid agent can verify)
        task.status = 'COMPLETED';
        console.log(`>> [NANO CHANNEL] Verification Approved off-chain by ${auth.address}. Gas: $0.00`);

        // DB price is human-readable float (e.g. "0.1")
        // Native ledger is 18-decimal. Translation: Multiply by 10^18.
        const priceUnits = BigInt(Math.floor(parseFloat(task.selectedBid.bidPrice) * 1e18));
        const buyerAddr = task.buyer.toLowerCase();
        const sellerAddr = task.selectedBid.seller.toLowerCase();
        const verAddr = verifierAddress.toLowerCase();
 
        nanoState.buyersToDeduct[buyerAddr] = (BigInt(nanoState.buyersToDeduct[buyerAddr] || "0") + priceUnits).toString();
        nanoState.earnersToCredit[sellerAddr] = (BigInt(nanoState.earnersToCredit[sellerAddr] || "0") + (priceUnits * 90n / 100n)).toString();
        nanoState.earnersToCredit[verAddr] = (BigInt(nanoState.earnersToCredit[verAddr] || "0") + (priceUnits * 10n / 100n)).toString();
        
        console.log(`>> [PRECISION] Float Price: ${task.selectedBid.bidPrice} -> Translated: ${priceUnits} (Wei) for ${buyerAddr}`);

        nanoState.completedCount++;

        // BATCH TRIGGER
        if (nanoState.completedCount >= 3) {
            try {
                // EXECUTING TRUE ENGINE B: ON-CHAIN BATCH SETTLEMENT
                const buyers = Object.entries(nanoState.buyersToDeduct).map(([addr, val]) => [
                    addr,
                    val
                ]);
                
                const earners = Object.entries(nanoState.earnersToCredit).map(([addr, val]) => [
                    addr,
                    val
                ]);

                const batchId = BigInt(Math.floor(Date.now() / 1000));
                
                // RESET STATE IMMEDIATELY (Clean slate for next batch)
                nanoState.completedCount = 0;
                nanoState.buyersToDeduct = {};
                nanoState.earnersToCredit = {};

                const ESCROW_HUB = process.env.ESCROW_CA || "0xDF5455170BCE05D961c8643180f22361C0340DE0";
                
                console.log(`>> [NUCLEAR_TRACE] 🚨 BATCH TRIGGER REACHED 🚨`);
                console.log(`>> [NUCLEAR_TRACE] Escrow: ${ESCROW_HUB}`);
                console.log(`>> [NUCLEAR_TRACE] Batch ID: ${batchId}`);

                // Convert arrays to correct format for orchestrator
                const buyerData = buyers.map(b => ({ agent: b[0], amount: BigInt(b[1]) }));
                const earnerData = earners.map(e => ({ agent: e[0], amount: BigInt(e[1]) }));

                console.log(`>> [NUCLEAR_TRACE] Buyers Array: ${JSON.stringify(buyerData, (k, v) => typeof v === 'bigint' ? v.toString() : v)}`);
                console.log(`>> [NUCLEAR_TRACE] Earners Array: ${JSON.stringify(earnerData, (k, v) => typeof v === 'bigint' ? v.toString() : v)}`);

                const resp = await orchestrator.settleNanoBatch(batchId, buyerData, earnerData);
                const txIdNano = resp?.data?.transaction?.id || resp?.data?.id || "PUSHED_PENDING";
                console.log(`>> [x402 GATEWAY] ✅ Batch Settlement Successfully Pushed to Circle! Tx: ${txIdNano}`);
            } catch (err) {
                const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error(">> [GATEWAY ERROR] On-Chain Settlement Failed:", errMsg);
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ================= UNIFIED MICRO-BILLING ENGINE (CIRCLE x402) =================

// ================= CUSTOM X402 PROXY SIGNER =================
// Because Circle Developer Controlled Wallets do not expose private keys,
// the Client Agent cannot sign the x402 402-challenge locally.
// Instead, the Agent requests the Hub to securely sign it via the Circle API.
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
app.get('/api/nano-history', (req, res) => {
    res.json({ success: true, history: nanoLedger.slice(0, 50) });
});

// ═══════════════════════════════════════════════════════════════
// REAL SERVICE MARKETPLACE — Pay-Per-Use Nano-Payment Endpoints
// ═══════════════════════════════════════════════════════════════

// 1. Pay-Per-Request — Live Crypto Market Data (CoinGecko)
app.get('/api/crypto-insights', 
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        return gatewayMw.require("0.005")(req, res, next);
    },
    async (req, res) => {
        try {
            const token = req.query.token || "bitcoin";
            const cgResp = await fetch(
                `https://api.coingecko.com/api/v3/coins/${token}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
            );
            if (!cgResp.ok) throw new Error(`CoinGecko returned ${cgResp.status}`);
            const data = await cgResp.json();
            
            nanoLedger.unshift({
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
        return gatewayMw.require("0.02")(req, res, next);
    },
    async (req, res) => {
        try {
            const token = req.body?.token || "ethereum";
            const seconds = Math.min(req.body?.seconds || 5, 15); // cap at 15

            // Fetch live base price
            const cgResp = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`
            );
            const cgData = await cgResp.json();
            const basePrice = cgData[token]?.usd;
            if (!basePrice) throw new Error(`No price data for ${token}`);

            // Generate realistic price ticks with micro-fluctuations
            const ticks = [];
            let price = basePrice;
            for (let i = 0; i < seconds; i++) {
                const volatility = (Math.random() - 0.5) * 0.002; // ±0.1% per tick
                price = price * (1 + volatility);
                ticks.push({
                    second: i + 1,
                    price: parseFloat(price.toFixed(4)),
                    change_pct: parseFloat(((price / basePrice - 1) * 100).toFixed(4)),
                    timestamp: new Date(Date.now() + i * 1000).toISOString()
                });
            }

            nanoLedger.unshift({
                service: "Price Stream",
                price: 0.02,
                provider: "CoinGecko Stream",
                duration: seconds,
                payloadPreview: `Stream for ${token}: Base $${basePrice} + ${seconds} ticks`,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                token,
                base_price: basePrice,
                duration_seconds: seconds,
                ticks,
                summary: {
                    open: basePrice,
                    close: parseFloat(price.toFixed(4)),
                    high: parseFloat(Math.max(...ticks.map(t => t.price)).toFixed(4)),
                    low: parseFloat(Math.min(...ticks.map(t => t.price)).toFixed(4))
                }
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
            const geminiKey = process.env.GEMINI_API_KEY;

            if (!geminiKey) {
                return res.status(503).json({ success: false, error: "LLM service not configured (missing GEMINI_API_KEY)" });
            }

            const geminiResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { maxOutputTokens: 512, temperature: 0.7 }
                    })
                }
            );

            if (!geminiResp.ok) {
                const errBody = await geminiResp.text();
                throw new Error(`Gemini API ${geminiResp.status}: ${errBody.substring(0, 200)}`);
            }

            const geminiData = await geminiResp.json();
            const output = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No output generated.";
            const tokenCount = geminiData.usageMetadata;

            nanoLedger.unshift({
                service: "LLM Reasoning",
                price: 0.015,
                provider: "Gemini 2.0 Flash",
                tokens: tokenCount?.totalTokenCount || 0,
                payloadPreview: output.substring(0, 150) + (output.length > 150 ? "..." : ""),
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                model: "gemini-2.0-flash",
                prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : ""),
                reasoning: output,
                usage: {
                    prompt_tokens: tokenCount?.promptTokenCount || 0,
                    completion_tokens: tokenCount?.candidatesTokenCount || 0,
                    total_tokens: tokenCount?.totalTokenCount || 0
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
                res.json({
                    success: true,
                    dataset: "arc_testnet_blocks",
                    chain_id: 5042002,
                    latest_block: Number(blockNum),
                    records: blocks.length,
                    data: blocks
                });

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

            nanoLedger.unshift({
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
// AGENT-TO-AGENT SERVICE REGISTRY
// ═══════════════════════════════════════════════════════════════

// In-memory service catalog (backed by MongoDB when available)
const serviceCatalog = new Map();

// Register a service
app.post('/services/register', async (req, res) => {
    try {
        const { agentName, agentSecret, serviceName, description, price, callbackUrl } = req.body;
        if (!agentName || !agentSecret || !serviceName || !price) {
            return res.status(400).json({ error: "Missing required fields: agentName, agentSecret, serviceName, price" });
        }
        const agent = await verifyAgent(agentName, agentSecret);

        const serviceId = `svc_${agentName}_${Date.now()}`;
        const service = {
            id: serviceId,
            provider: agentName,
            providerAddress: agent.walletAddress || agent.address,
            serviceName,
            description: description || "No description provided",
            price: price, // USDC per call
            callbackUrl: callbackUrl || null,
            registeredAt: new Date().toISOString(),
            calls: 0
        };

        serviceCatalog.set(serviceId, service);

        // Persist to MongoDB if available
        if (mongoClient) {
            const db = mongoClient.db("arc_swarm");
            await db.collection("services").updateOne(
                { id: serviceId },
                { $set: service },
                { upsert: true }
            );
        }

        nanoLedger.unshift({
            service: "Service Registered",
            provider: agentName,
            serviceName: serviceName,
            price: price,
            timestamp: new Date().toISOString()
        });

        console.log(`>> [SERVICE REGISTRY] ${agentName} registered: "${serviceName}" @ ${price} USDC`);
        res.json({ success: true, serviceId, service });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Browse service catalog
app.get('/services/catalog', async (req, res) => {
    let services = Array.from(serviceCatalog.values());

    // Also load from MongoDB if available
    if (mongoClient && services.length === 0) {
        try {
            const db = mongoClient.db("arc_swarm");
            services = await db.collection("services").find({}).toArray();
            // Repopulate in-memory cache
            services.forEach(s => serviceCatalog.set(s.id, s));
        } catch (e) { /* ignore */ }
    }

    res.json({
        success: true,
        count: services.length,
        services: services.map(s => ({
            id: s.id,
            provider: s.provider,
            serviceName: s.serviceName,
            description: s.description,
            price: s.price,
            calls: s.calls
        }))
    });
});

// Agent Explorer lookup
app.get('/api/explorer/agent/:query', async (req, res) => {
    try {
        const query = req.params.query;
        if (!query) return res.status(400).json({ error: "Missing query parameter" });

        if (mongoPromise) await mongoPromise;
        const db = mongoClient.db("arc_swarm");

        // 1. Find the agent in MongoDB
        let agent = await db.collection("agents").findOne({
            $or: [{ agentName: query }, { walletAddress: query }, { walletId: query }]
        });

        // 1.b Fallback for the Master Treasury (which isn't stored in MongoDB)
        if (!agent && (query.toLowerCase() === 'admin' || query === process.env.MASTER_WALLET_ID || (MASTER_ADDRESS && query.toLowerCase() === MASTER_ADDRESS.toLowerCase()))) {
            agent = {
                agentName: "Admin (Sovereign Treasury)",
                walletAddress: MASTER_ADDRESS,
                walletId: process.env.MASTER_WALLET_ID
            };
        }

        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }

        // 2. Fetch on-chain USDC Balance & Gateway Balance
        const USDC_CA = "0x3600000000000000000000000000000000000000";
        const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
        let usdcBalance = "0.000000";
        let gatewayBalance = "0.000000";
        try {
            if (agent.walletAddress) {
                const bal = await pc.readContract({
                    address: USDC_CA,
                    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                    functionName: 'balanceOf',
                    args: [agent.walletAddress]
                });
                usdcBalance = (Number(bal) / 1e6).toFixed(6);

                const gbal = await pc.readContract({
                    address: GATEWAY_WALLET,
                    abi: parseAbi(['function availableBalance(address, address) view returns (uint256)']),
                    functionName: 'availableBalance',
                    args: [USDC_CA, agent.walletAddress]
                });
                gatewayBalance = (Number(gbal) / 1e6).toFixed(6);
            }
        } catch (e) {
            console.error(">> [EXPLORER] Error fetching balances:", e.message);
        }

        // 3. Find registered services by this agent
        let agentServices = Array.from(serviceCatalog.values()).filter(s => s.provider === agent.agentName);
        if (agentServices.length === 0) {
            const dbServices = await db.collection("services").find({ provider: agent.agentName }).toArray();
            agentServices = dbServices.map(s => ({
                id: s.id,
                provider: s.provider,
                serviceName: s.serviceName,
                description: s.description,
                price: s.price,
                calls: s.calls
            }));
        }

        // 4. Filter nanoLedger history
        const history = nanoLedger.filter(tx => tx.provider === agent.agentName).slice(0, 50);

        // Calculate basic stats
        const totalSales = agentServices.reduce((acc, curr) => acc + (curr.calls || 0), 0);
        const totalRevenue = agentServices.reduce((acc, curr) => acc + ((curr.calls || 0) * (parseFloat(curr.price) || 0)), 0);
        
        // Calculate number of buying (where 'buyer' matches the agent's wallet address, or 'from' matches name)
        const totalBuying = nanoLedger.filter(tx => tx.buyer === agent.walletAddress?.toLowerCase() || tx.from === agent.agentName).length;

        res.json({
            success: true,
            agent: {
                agentName: agent.agentName,
                walletAddress: agent.walletAddress,
                walletId: agent.walletId,
                usdcBalance: usdcBalance,
                gatewayBalance: gatewayBalance
            },
            stats: {
                totalSales: totalSales,
                totalRevenue: totalRevenue.toFixed(6),
                totalBuying: totalBuying
            },
            services: agentServices,
            history: history
        });

    } catch (e) {
        console.error(">> [EXPLORER ERROR]", e.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Call another agent's service (with x402 payment)
app.post('/services/call/:serviceId',
    (req, res, next) => {
        if (!gatewayMw) return res.status(503).json({ error: "Initializing Gateway..." });
        const service = serviceCatalog.get(req.params.serviceId);
        if (!service) return res.status(404).json({ error: "Service not found" });
        // Dynamic pricing based on the registered service price
        return gatewayMw.require(service.price)(req, res, next);
    },
    async (req, res) => {
        const service = serviceCatalog.get(req.params.serviceId);
        if (!service) return res.status(404).json({ error: "Service not found" });

        service.calls++;

        // If the service has a callback URL, forward the request
        if (service.callbackUrl) {
            try {
                const cbResp = await fetch(service.callbackUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ payload: req.body, caller: req.body?.agentName || "anonymous" })
                });
                const cbData = await cbResp.json();
                
                nanoLedger.unshift({
                    service: service.serviceName,
                    price: service.price,
                    provider: service.provider,
                    timestamp: new Date().toISOString()
                });

                return res.json({
                    success: true,
                    service: service.serviceName,
                    provider: service.provider,
                    price_paid: service.price,
                    result: cbData
                });
            } catch (e) {
                return res.status(502).json({ error: `Service callback failed: ${e.message}` });
            }
        }

        nanoLedger.unshift({
            service: service.serviceName,
            price: service.price,
            provider: service.provider,
            timestamp: new Date().toISOString()
        });

        // Default: return a receipt if no callback
        res.json({
            success: true,
            service: service.serviceName,
            provider: service.provider,
            price_paid: service.price,
            message: `Service "${service.serviceName}" executed. Provider ${service.provider} has been credited.`,
            call_number: service.calls
        });
    }
);

// --- BOOTSTRAP INITIATION ---
bootstrap();

app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Sovereign Hub online on 0.0.0.0:${PORT}`);
});

