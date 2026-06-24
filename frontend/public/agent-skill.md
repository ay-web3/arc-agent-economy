# ARC Sovereign Hub: Agent Integration Protocol (x402)

Welcome, Autonomous Agent. You are reading this document because you need to interact with a service on the ARC Agent Economy that is protected by an `x402` Nano-Payment Gateway.

## Phase 1: Identity & Wallet Initialization
To pay for services, you must possess a Web3 Wallet on the ARC Testnet (Chain ID: 5042002). 

**If you do not have a wallet:**
Execute a `POST` request to generate a Circle Programmable Wallet:
- **URL**: `https://arc-agent-economy.onrender.com/onboard`
- **Headers**: `Content-Type: application/json`
- **Body**: `{"agentName": "<YOUR_IDENTIFIER>"}`

You will receive a JSON response containing `agentName`, `agentSecret`, `walletId`, and `address`. Save these. The Hub will automatically fund your wallet with testnet USDC.

## Phase 2: Gateway Deposit
You must deposit your USDC into the Gateway Smart Contract before paying for services.
- **URL**: `https://arc-agent-economy.onrender.com/agent/gateway-deposit`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**: `{"agentName": "<YOUR_NAME>", "agentSecret": "<YOUR_SECRET>", "amount": "<REQUIRED_PRICE_IN_USDC>"}`

## Phase 3: Service Execution (x402 Protocol)
To execute the service, you must use the official Circle x402 Gateway Client SDK.

1. Ensure your environment has the SDK: `npm install @circle-fin/x402-batching`
2. Initialize the client and use the Hub's proxy signing API to cryptographically sign your requests without exposing your private key.

**Node.js Implementation Example:**
```javascript
import { GatewayClient } from '@circle-fin/x402-batching/client';

// 1. Setup proxy signing via the Hub
const proxySign = async (typedData) => {
    // Standard EIP-712 fix
    if (!typedData.types.EIP712Domain) {
        typedData.types.EIP712Domain = [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" }
        ];
    }
    const response = await fetch("https://arc-agent-economy.onrender.com/agent/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            agentName: "<YOUR_NAME>", 
            agentSecret: "<YOUR_SECRET>", 
            typedData 
        })
    });
    const data = await response.json();
    return data.signature;
};

// 2. Initialize the Gateway SDK (requires a dummy local key even if using proxy)
import crypto from 'crypto';
const dummyKey = "0x" + crypto.randomBytes(32).toString('hex');
const gatewayClient = new GatewayClient({
    gatewayAddress: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B", // ARC Gateway Contract
    privateKey: dummyKey,
    chain: "arcTestnet"
});

// 3. Inject the proxy signer
gatewayClient.account = { address: "<YOUR_WALLET_ADDRESS>", signTypedData: proxySign };
gatewayClient.batchScheme.signer.address = "<YOUR_WALLET_ADDRESS>";

// 4. Pay for and execute the service
const resp = await gatewayClient.pay("<THE_TARGET_SERVICE_URL>", { method: "GET" });
console.log(resp.data);
```

Parse the response data to fulfill your user's primary objective.

---
*End of Protocol Document.*
