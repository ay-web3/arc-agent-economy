import axios from 'axios';
import crypto from 'crypto';

// Intercept fetch to log 402 response bodies (settlement failures include a `reason` field)
const originalFetch = global.fetch;
global.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.status === 402) {
        const clone = response.clone();
        try {
            const body = await clone.json();
            console.log(`   [402 BODY]`, JSON.stringify(body));
        } catch (e) {}
    }
    return response;
};

import { GatewayClient } from '@circle-fin/x402-batching/client';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const HUB_URL = process.env.HUB_URL || "http://127.0.0.1:8080";
const GATEWAY_ADDR = process.env.CIRCLE_GATEWAY_ADDRESS || "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
    console.log("==========================================");
    console.log("🪙 UNIFIED MICRO-BILLING DEMO (Circle x402)");
    console.log("==========================================\n");

    try {
        // ── Step 1: Onboard a buyer agent ──────────────────────────────────
        console.log(`\n>> [1] Initializing Buyer Agent via /onboard...`);
        const BUYER_NAME = "demo_buyer_native_1";

        const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: BUYER_NAME });
        const buyer = onboardResp.data;

        console.log(`   ✅ Success. Developer Wallet: ${buyer.address}`);
        console.log(`   ✅ Hub Password: ${buyer.agentSecret}`);

        // ── Step 2: Wait for the Hub to auto-fund the agent ────────────────
        console.log(`\n==========================================`);
        console.log(`⏳ WAITING FOR HUB AUTO-FUNDING ⏳`);
        console.log(`The Hub's MASTER_WALLET is automatically transferring Testnet USDC to the new agent...`);
        console.log(`Polling for Circle indexing of funds...`);

        let funded = false;
        for (let i = 0; i < 30; i++) {
            await delay(5000);
            try {
                const bResp = await axios.get(`${HUB_URL}/debug/wallet/${buyer.walletId}`);
                if (bResp.data && bResp.data.balances) {
                    const usdc = bResp.data.balances.find(b => b.token.symbol === "USDC" && b.token.isNative);
                    if (usdc && parseFloat(usdc.amount) >= 0.005) {
                        console.log(`   ✅ Agent is fully funded! Balance: ${usdc.amount} USDC`);
                        funded = true;
                        break;
                    }
                }
            } catch (e) {
                // Ignore errors during polling
            }
            process.stdout.write(".");
        }
        console.log(`\n==========================================\n`);

        if (!funded) {
            console.log("⚠️ Agent was not funded in time. Proceeding anyway, but it may fail.");
        }

        // ── Step 3: Create GatewayClient with dummy key, then patch it ─────
        //
        // GatewayClient requires a private key in its constructor, which it
        // uses to derive an account (address + signTypedData). It then bakes
        // a `signer` object { address, signTypedData } into BatchEvmScheme.
        //
        // Because Circle Developer-Controlled Wallets never expose private
        // keys, we:
        //   1. Pass a dummy key to satisfy the constructor.
        //   2. Override `gatewayClient.account` with the buyer's real address
        //      and a proxy signTypedData that delegates to the Hub.
        //   3. CRITICALLY: also patch `batchScheme.signer.address` so the
        //      `from` field in the EIP-712 message matches the real wallet.
        //      Without this, `from` would be the dummy key's address, causing
        //      Circle Gateway to reject the signature (signer ≠ from).

        const dummyKey = "0x" + crypto.randomBytes(32).toString('hex');
        const gatewayClient = new GatewayClient({
            gatewayAddress: GATEWAY_ADDR,
            privateKey: dummyKey,
            chain: "arcTestnet"
        });

        // Proxy signTypedData: intercept signing and delegate to the Hub
        const proxySignTypedData = async (typedData) => {
            console.log(`   [PROXY] Signing via Hub for wallet ${buyer.address}...`);

            // Circle API requires EIP712Domain in the types object
            if (!typedData.types.EIP712Domain) {
                typedData.types.EIP712Domain = [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" }
                ];
            }

            // Serialize BigInts to strings for JSON transport
            const serialized = JSON.stringify(typedData, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            );

            const signResp = await axios.post(`${HUB_URL}/agent/sign-402`, {
                agentName: BUYER_NAME,
                agentSecret: buyer.agentSecret,
                typedData: JSON.parse(serialized)
            });

            return signResp.data.signature;
        };

        // Override the account used for signing
        gatewayClient.account = {
            address: buyer.address,
            signTypedData: proxySignTypedData
        };

        // THE CRITICAL FIX: Patch the internal BatchEvmScheme signer address.
        // The constructor froze signer.address to the dummy key's derived address.
        // We must update it to the buyer's real wallet address so that the `from`
        // field in TransferWithAuthorization matches the actual signer.
        gatewayClient.batchScheme.signer.address = buyer.address;

        // ── Step 3b: Deposit USDC into the GatewayWallet contract ──────────
        // The GatewayWalletBatched scheme requires funds to be deposited into
        // the Gateway contract before settlement can succeed. The Hub handles
        // the approve + deposit on-chain transactions via Circle's API.
        console.log(`\n>> [1b] Depositing USDC into GatewayWallet for x402 settlement...`);
        console.log(`   This requires two on-chain transactions (approve + deposit).`);
        console.log(`   Please wait ~30-60 seconds...\n`);
        try {
            const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
                agentName: BUYER_NAME,
                agentSecret: buyer.agentSecret,
                amount: "0.1" // Deposit 0.1 USDC (enough for many micro-payments)
            }, { timeout: 180000 }); // 3 minute timeout for on-chain txs
            console.log(`   ✅ Gateway Deposit Complete!`);
            console.log(`   Approve TX: ${depositResp.data.approveState}`);
            console.log(`   Deposit TX: ${depositResp.data.depositState}`);
        } catch (err) {
            console.error(`   ❌ Gateway Deposit Failed: ${err.response?.data?.error || err.message}`);
            console.log(`   Continuing anyway (settlement may fail)...\n`);
        }

        await delay(2000);

        // ── Step 4: Pay-Per-Request ────────────────────────────────────────
        console.log(`>> [2] Testing: Pay-Per-Request (API Call)`);
        try {
            const resp = await gatewayClient.pay(`${HUB_URL}/api/crypto-insights`, { method: "GET" });
            console.log(`   ✅ Paid: ${resp.formattedAmount} USDC`);
            console.log(`   📦 Content: "${JSON.stringify(resp.data).substring(0, 100)}..."`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }

        await delay(1000);

        // ── Step 5: Pay-Per-Second (Streaming) ─────────────────────────────
        console.log(`>> [3] Testing: Pay-Per-Second (Streaming)`);
        console.log(`   ⏳ Simulating a stream...`);
        try {
            const resp = await gatewayClient.pay(`${HUB_URL}/api/stream`, { method: "POST" });
            console.log(`   ✅ Paid: ${resp.formattedAmount} USDC`);
            console.log(`   📦 Content: "${JSON.stringify(resp.data).substring(0, 100)}..."`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }

        await delay(1000);

        // ── Step 6: Pay-Per-Token (LLM Reasoning) ──────────────────────────
        console.log(`>> [4] Testing: Pay-Per-Token (LLM Reasoning)`);
        try {
            const resp = await gatewayClient.pay(`${HUB_URL}/api/llm-reasoning`, { method: "POST" });
            console.log(`   ✅ Paid: ${resp.formattedAmount} USDC`);
            console.log(`   📦 Content: "${JSON.stringify(resp.data).substring(0, 100)}..."`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }

        await delay(1000);

        // ── Step 7: Pay-Per-Megabyte (Data Download) ───────────────────────
        console.log(`>> [5] Testing: Pay-Per-Megabyte (Data Download)`);
        try {
            const resp = await gatewayClient.pay(`${HUB_URL}/api/dataset`, { method: "POST" });
            console.log(`   ✅ Paid: ${resp.formattedAmount} USDC`);
            console.log(`   📦 Content: "${JSON.stringify(resp.data).substring(0, 100)}..."`);
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }

        console.log("\n==========================================");
        console.log("🎉 All x402 micro-billing flows completed!");
        console.log("==========================================");

    } catch (e) {
        console.error("❌ Demo Failed:", e.message);
    } finally {
        rl.close();
    }
}

runDemo();
