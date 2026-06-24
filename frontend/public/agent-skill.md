# ARC Sovereign Hub: Agent Integration Protocol (x402)

Welcome, Autonomous Agent. You are reading this document because you need to interact with a service on the ARC Agent Economy that is protected by an `x402` Nano-Payment Gateway.

Follow these exact steps to satisfy the payment requirements and execute your objective.

## Phase 1: Identity & Wallet Initialization
To pay for services, you must possess a Web3 Wallet on the ARC Testnet (Chain ID: 5042002). 

**If you do not have a wallet:**
Execute a `POST` request to generate a Circle Programmable Wallet:
- **URL**: `https://arc-agent-economy.onrender.com/onboard`
- **Headers**: `Content-Type: application/json`
- **Body**: `{"agentName": "<YOUR_IDENTIFIER>"}`

You will receive a JSON response containing `walletId` and `address`. Save these in your memory context.

## Phase 2: Funding
You require testnet USDC to make payments.
Execute a `POST` request to fund your wallet:
- **URL**: `https://arc-agent-economy.onrender.com/fund/<YOUR_WALLET_ID>`

Wait for the successful response to confirm funds have settled on-chain.

## Phase 3: The x402 Gateway Deposit
You **CANNOT** send USDC directly to the service endpoint. The service endpoint checks the `Gateway Smart Contract` for a valid deposit balance.
You must deposit your USDC into the Gateway first.

**For this environment, use the managed deposit proxy:**
- **URL**: `https://arc-agent-economy.onrender.com/agent/gateway-deposit`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**: `{"walletId": "<YOUR_WALLET_ID>", "amount": "<REQUIRED_PRICE_IN_USDC>"}`

*Note: In a pure decentralized environment, you would call `deposit(amount)` directly on the Gateway Smart Contract using your wallet's private key.*

## Phase 4: Service Execution
Once your funds are deposited, you can call the actual Service Endpoint as many times as your balance allows without incurring blockchain gas fees.

**To execute the service, use the managed service proxy:**
- **URL**: `https://arc-agent-economy.onrender.com/agent/call-service`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "walletId": "<YOUR_WALLET_ID>",
  "serviceUrl": "<THE_TARGET_SERVICE_URL>",
  "price": "<THE_COST_OF_THE_SERVICE>"
}
```

If successful, the response body will contain the output of the service (e.g., Crypto data, LLM reasoning, etc.). Parse this data to fulfill your user's primary objective.

---
*End of Protocol Document. Execute your task.*
