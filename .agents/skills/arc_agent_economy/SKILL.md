---
name: ARC Agent Economy Developer Guide
description: Comprehensive documentation for building, deploying, and integrating autonomous agents within the ARC Agent Economy. Covers wallet onboarding, Circle x402 Gateway proxy-signing, micro-payments, and all 7 core Sovereign Hub services.
---

# ARC Agent Economy Developer Guide

The ARC Agent Economy allows autonomous AI agents to seamlessly purchase real-world data, LLM reasoning, and streaming services from a Sovereign Hub using micro-transactions powered by the **Circle x402 Gateway**.

This guide is designed for AI coding assistants writing integration scripts or new features for the ARC Agent Economy. 

> [!CAUTION]
> Deviating from the authentication or proxy-signing logic defined below will result in `402 Payment Required` or `500 Internal Server Error` responses.

---

## 1. Agent Onboarding & Funding

Before an agent can consume services, it must register with the Sovereign Hub to instantiate its Smart Contract Wallet.

### Onboarding
Send a POST request to `/onboard` with a unique `agentName`.
```javascript
const onboardResp = await axios.post(`${HUB_URL}/onboard`, { agentName: BUYER_NAME });
// Returns: { agentName, agentSecret, address, walletAddress, walletId }
```

### Auto-Funding
The Sovereign Hub acts as a paymaster and automatically funds newly onboarded agents with **0.5 USDC** on the ARC testnet. 
> [!TIP]
> Always implement a ~5 second delay (`await delay(5000)`) after onboarding to allow the blockchain funding transaction to clear.

---

## 2. Gateway Deposit Lifecycle

To engage in fast, off-chain micro-transactions, agents must deposit their on-chain USDC into the Circle x402 Gateway.

> [!WARNING]
> Because agents are funded with exactly 0.5 USDC, **deposits must not exceed 0.45 USDC** to account for network variability. Attempting to deposit 0.5 USDC or more will fail on-chain.

**Use the Hub Proxy for Deposits:**
The Hub manages the agent's private keys. You must use the Hub's proxy endpoint to initiate the deposit.
```javascript
const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
    agentName: BUYER_NAME, 
    agentSecret: agentSecret, 
    amount: "0.45"
}, { timeout: 120000 }); // High timeout required for on-chain confirmation
// Response: { approveState, depositState }
```

---

## 3. Circle Gateway Proxy Signing (CRITICAL)

When consuming paid endpoints, the Gateway requires cryptographic signatures to authorize micro-payments (`Payment-Signature` headers). Because the agent's keys are locked in the Hub, **local key signing is strictly prohibited and will fail.**

You must initialize `@circle-fin/x402-batching` with a dummy key, and explicitly override the signing method to proxy requests back to the Hub:

```javascript
import { GatewayClient } from '@circle-fin/x402-batching/client';
import crypto from 'crypto';

// 1. Initialize with dummy key
const gatewayClient = new GatewayClient({
    privateKey: "0x" + crypto.randomBytes(32).toString('hex'), 
    gatewayAddress: GATEWAY_ADDR, 
    chain: "arcTestnet"
});

// 2. Define proxy signing logic
const proxySign = async (typedData) => {
    if (!typedData.types.EIP712Domain) {
        typedData.types.EIP712Domain = [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" }
        ];
    }
    const serialized = JSON.stringify(typedData, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    
    const signResp = await axios.post(`${HUB_URL}/agent/sign-402`, {
        agentName: BUYER_NAME,
        agentSecret: agentSecret,
        typedData: JSON.parse(serialized)
    });
    return signResp.data.signature;
};

// 3. Override signer with actual agent address
gatewayClient.account = { address: buyerAddress, signTypedData: proxySign };
gatewayClient.batchScheme.signer.address = buyerAddress;
```

---

## 4. Standard X402 Payment Flow

Every paid service requires a two-step handshake:
1. **Initial Request**: Fails intentionally with `402 Payment Required` returning a `PAYMENT-REQUIRED` header.
2. **Signed Request**: Uses `gatewayClient.batchScheme.createPaymentPayload` to sign the required cost, and resends the request with the `Payment-Signature` header.

### Single-Shot Request Example
```javascript
// Step 1: Trigger 402
const initialResp = await fetch(`${HUB_URL}/api/market-data`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "bitcoin" })
});

// Step 2: Parse requirement and sign
const paymentRequiredHeader = initialResp.headers.get("PAYMENT-REQUIRED");
const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"));
const batchingOption = paymentRequired.accepts.find(opt => opt.extra?.name === "GatewayWalletBatched");

const paymentPayload = await gatewayClient.batchScheme.createPaymentPayload(
    paymentRequired.x402Version || 2, batchingOption
);
const paymentHeader = Buffer.from(JSON.stringify({
    ...paymentPayload, resource: paymentRequired.resource, accepted: batchingOption
})).toString("base64");

// Step 3: Final Execution
const finalResp = await fetch(`${HUB_URL}/api/market-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Payment-Signature": paymentHeader },
    body: JSON.stringify({ token: "bitcoin" })
});
```

---

## 5. Sovereign Hub Service Catalog

The Hub offers 7 core services. When building integrations, refer to the pricing and endpoint specifications below:

| ID | Service Name | Endpoint | Cost | Data Type | Notes |
|---|---|---|---|---|---|
| **1** | Market Data | `/api/market-data` | 0.005 USDC | JSON | Requires `{ token: string }` |
| **2** | Live Price Stream | `/api/stream` | 0.02 USDC/sec | SSE Stream | Requires `{ token: string, seconds: number }`. Read via `resp.body.getReader()` |
| **3** | LLM Reasoning | `/api/llm-reasoning` | 0.015 USDC | JSON | Requires `{ prompt: string }` |
| **4** | ARC Testnet Data | `/api/arc-testnet-data` | 0.1 USDC | JSON | Requires `{ blocks: number }` |
| **5** | Polymarket Trending | `/api/polymarket/trending` | 0.05 USDC | JSON | No body required |
| **6** | Polymarket Oracle | `/api/polymarket/oracle/:eventId`| 0.01 USDC | JSON | Path parameter `eventId` |
| **7** | Orderbook Stream | `/api/polymarket/stream/:eventId`| 0.02 USDC/sec | SSE Stream | Path parameter `eventId`, body `{ duration_seconds: number }`. Read via `resp.body.getReader()` |

> [!IMPORTANT]
> For Streaming Services (2 & 7), always use `fetch` and consume the `response.body` using a `TextDecoder` reader. Avoid `axios` for SSE streams as it can cause header serialization issues that invalidate the Gateway Signature payload hash.

---

## 6. Settlement & Cooperative Close

When an agent finishes its tasks, the accumulated micro-transactions must be settled on the blockchain. The Sovereign Hub allows for instant off-ramping to a Master Seller Wallet via Cooperative Close.

```javascript
const wResp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, {
    agentName: "Admin", // Special admin bypass
    agentSecret: "SOVEREIGN_ADMIN_2026", 
    amount: "0.05"
}, { timeout: 60000 });
console.log(`Settled TX: ${wResp.data.withdrawTxId}`);
```

---

## 7. Bot-to-Bot Economy (Agents as Producers)

The ARC Agent Economy allows agents to act as both **consumers** and **producers**. An agent can buy raw data from the Hub, process it, and sell it to other agents as a new service using the Circle Gateway.

### Setting up a Producer Agent
A Producer Agent must run its own HTTP server (e.g., Express) and protect its routes using `createGatewayMiddleware`.

```javascript
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';

// 1. Initialize the middleware using the Agent's public wallet address
const agentGatewayMw = createGatewayMiddleware({
    sellerAddress: myAgentAddress, // The address obtained from /onboard
    networks: ["eip155:5042002"],
    facilitatorUrl: "https://gateway-api-testnet.circle.com"
});

// 2. Protect a route with a custom price
app.post('/api/my-custom-service', agentGatewayMw.require("0.05"), async (req, res) => {
    // The consumer has already paid 0.05 USDC to reach this logic!
    res.json({ data: "High value proprietary signal" });
});
```

Because `createGatewayMiddleware` only requires a `sellerAddress` (and not a private key), any agent onboarded to the network can instantly monetize its API endpoints without needing advanced key management!
