import express from 'express';

// --- GLOBAL DIAGNOSTIC STORAGE ---
let SDK_LOAD_ERROR = null;
let client = null;
let uuidv4 = null;

const app = express();
app.use(express.json());

/**
 * @title SwarmOrchestratorAPI (Dynamic Resolution Edition)
 * @dev Defers all external SDK resolution until AFTER port binding to isolate startup crashes.
 */

// --- BOOTSTRAP: THE STEALTH IMPORT ---
async function bootstrap() {
    try {
        console.log(">> [BOOT] Initiating Dynamic SDK Resolution...");
        
        // Dynamic loading bypassing ESM hoisting
        const { CircleDeveloperControlledWalletsClient } = await import('@circle-fin/developer-controlled-wallets');
        const { v4 } = await import('uuid');
        uuidv4 = v4;

        const API_KEY = process.env.CIRCLE_API_KEY;
        const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || process.env.ENTITY_SECRET;

        if (API_KEY && ENTITY_SECRET) {
            client = new CircleDeveloperControlledWalletsClient(API_KEY, ENTITY_SECRET);
            console.log(">> [SUCCESS] Circle SDK Loaded dynamically.");
        } else {
            console.warn(">> [WARN] SDK Loaded but Secrets are MISSING.");
        }
    } catch (e) {
        console.error(">> [FATAL] Dynamic Import Failed.");
        SDK_LOAD_ERROR = {
            message: e.message,
            stack: e.stack,
            time: new Date().toISOString()
        };
        console.error(e);
    }
}

// --- ENDPOINTS ---
app.get('/health', (req, res) => {
    res.json({ 
        status: "GREEN_PROBE", 
        sdk_loaded: !!client,
        error: SDK_LOAD_ERROR,
        timestamp: new Date().toISOString()
    });
});

app.post('/onboard', async (req, res) => {
    if (!client) return res.status(503).json({ error: "SDK not loaded", details: SDK_LOAD_ERROR });
    // Minimal onboard for testing
    res.json({ success: true, message: "Onboard logic ready (Dynamic Mode)" });
});

const PORT = process.env.PORT || 8080;

// IMMEDIATE BINDING: This guarantees we pass the Cloud Run health check
app.listen(PORT, "0.0.0.0", () => {
    console.log(`>> [HEALTH] Resilient Diagnostic Port active on 0.0.0.0:${PORT}`);
    // Attempt the stealth import in the background
    bootstrap();
});
