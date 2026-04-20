import express from 'express';
import { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { v4 as uuidv4 } from 'uuid';

// --- GLOBAL ERROR CAPTURE ---
process.on('uncaughtException', (err) => {
    console.error('>> [CRITICAL] Uncaught Exception:', err.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('>> [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(express.json());

/**
 * @title SwarmOrchestratorAPI (Restoration Stage 1)
 * @dev Re-introducing Circle SDK logic to the proven "Green Base."
 */

// --- CONFIGURATION ---
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;
const WALLET_SET_ID = process.env.WALLET_SET_ID;

console.log(">> [BOOT] Starting Restoration Stage 1...");
console.log(">> [DEBUG] Environment Inspection: API_KEY present:", !!API_KEY);
console.log(">> [DEBUG] Environment Inspection: WALLET_SET_ID:", WALLET_SET_ID);

// --- INITIALIZATION ---
let client = null;
try {
    if (API_KEY && ENTITY_SECRET) {
        console.log(">> [DEBUG] Attempting to construct Circle SDK Client...");
        client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);
        console.log(">> [INIT] Circle SDK Client Initialized Successfully.");
    } else {
        console.warn(">> [WARN] Running in DEGRADED MODE: Missing required secrets.");
    }
} catch (e) {
    console.error(">> [CRITICAL_ERROR] Circle SDK failed to initialize:", e.message);
    console.error(e.stack);
}

// --- TEMP IN-MEMORY DB (Restoring Persitence next stage) ---
let IN_MEMORY_DB = {};

// --- ENDPOINTS ---
app.get('/health', (req, res) => {
    res.json({ 
        status: "STAGE_1_RESTORATION", 
        sdk_initialized: !!client,
        timestamp: new Date().toISOString()
    });
});

app.post('/onboard', async (req, res) => {
    if (!client) return res.status(503).json({ error: "Circle SDK not initialized" });
    const { agentName } = req.body;
    try {
        console.log(`>> [ONBOARD] Creating wallet for agent: ${agentName}...`);
        const response = await client.createWallets({
            idempotencyKey: uuidv4(),
            accountType: "EOA",
            blockchains: ["ARC-TESTNET"],
            count: 1,
            walletSetId: WALLET_SET_ID
        });
        const newWallet = response.data.wallets[0];
        
        IN_MEMORY_DB[agentName] = newWallet.id;

        res.json({ 
            success: true, 
            agentId: agentName, 
            address: newWallet.address,
            walletId: newWallet.id
        });
    } catch (e) {
        console.error(">> [ERROR] Onboarding failed:", e.message);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [SUCCESS] Restoration Hub Stage 1 listening on 0.0.0.0:${PORT}`);
});
