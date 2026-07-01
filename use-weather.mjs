import { GatewayClient } from '@circle-fin/x402-batching/client';
import crypto from 'crypto';
import axios from 'axios';
import { MongoClient } from 'mongodb';

const HUB_URL = "https://arc-agent-economy.onrender.com";
const agentName = "Antigravity_Agent";
const agentSecret = "284f50e753e1ec8551744faeba8d5279";
const serviceUrl = "http://localhost:8081/api/weather-service";
const GATEWAY_ADDR = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

async function useService() {
    console.log("0. Fetching buyer address from Explorer API...");
    const agentResp = await axios.get(`${HUB_URL}/api/explorer/agent/${agentName}`);
    const buyerAddress = agentResp.data.agent.walletAddress;
    console.log(`   Agent address: ${buyerAddress}`);

    console.log("0.5 Depositing funds into Gateway...");
    try {
        const depositResp = await axios.post(`${HUB_URL}/agent/gateway-deposit`, {
            agentName, agentSecret, amount: "0.45"
        }, { timeout: 120000 });
        console.log("   Deposit success:", depositResp.data);
    } catch (e) {
        console.log("   Deposit skipped/failed:", e.response?.data || e.message);
    }

    console.log(`1. Pinging ${serviceUrl}...`);
    let initRes;
    try {
        initRes = await axios.post(serviceUrl, { location: "Japan" }, {
            validateStatus: () => true
        });
    } catch (e) {
        throw new Error(`Failed to ping service: ${e.message}`);
    }

    if (initRes.status === 402) {
        console.log("   Received 402 Payment Required.");
        const challengeHeader = initRes.headers["payment-required"];
        const paymentRequired = JSON.parse(Buffer.from(challengeHeader, "base64").toString("utf-8"));
        
        const batchingOption = paymentRequired.accepts.find(opt => opt.extra?.name === "GatewayWalletBatched");
        const x402Version = paymentRequired.x402Version || 2;

        console.log(`2. Setting up proxy GatewayClient for ${batchingOption.cost} atomic units...`);
        
        // 1. Initialize with a dummy key
        const dummyKey = "0x" + crypto.randomBytes(32).toString('hex');
        const gatewayClient = new GatewayClient({
            privateKey: dummyKey, gatewayAddress: GATEWAY_ADDR, chain: "arcTestnet"
        });

        // 2. Define the proxy signing function
        const proxySign = async (typedData) => {
            console.log("Proxy Sign Typed Data Domain:", JSON.stringify(typedData.domain, null, 2));
            console.log("PrimaryType:", typedData.primaryType);
            console.log("Types:", JSON.stringify(typedData.types, null, 2));
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
                agentName,
                agentSecret,
                typedData: JSON.parse(serialized)
            });
            return signResp.data.signature;
        };

        // 3. Override the GatewayClient's internal signer
        gatewayClient.account = { address: buyerAddress, signTypedData: proxySign };
        gatewayClient.batchScheme.signer.address = buyerAddress;

        console.log("3. Creating payment payload & signing via proxy...");
        const paymentPayload = await gatewayClient.batchScheme.createPaymentPayload(x402Version, batchingOption);
        
        // CRITICAL FIX: Replace the dummy 'from' address with the real agent's address!
        paymentPayload.payload.authorization.from = buyerAddress;
        
        const paymentHeader = Buffer.from(JSON.stringify({
            ...paymentPayload,
            resource: paymentRequired.resource,
            accepted: batchingOption
        })).toString("base64");

        console.log("4. Resubmitting request with payment signature...");
        const paidRes = await axios.post(serviceUrl, { location: "Japan" }, {
            headers: { 
                "Content-Type": "application/json",
                "Payment-Signature": paymentHeader 
            },
            validateStatus: () => true
        });
        
        console.log(`   Final Status: ${paidRes.status}`);
        console.log(`   Response:`, paidRes.data);

        console.log("\n5. Submitting 2-star rating to trigger AI Supreme Court dispute...");
        try {
            const rateResp = await axios.post(`${HUB_URL}/api/registry/rate`, {
                url: serviceUrl,
                rating: 2,
                receipt: `Bearer ${paymentHeader}`,
                prompt: "Get the current weather for London",
                signal: "The agent returned completely wrong formatting and inaccurate data."
            });
            console.log("   Rating success:", rateResp.data);
        } catch (e) {
            console.error("   Rating failed:", e.response?.data || e.message);
        }
    } else {
        console.log(`   Unexpected status: ${initRes.status}`);
        console.log(initRes.data);
    }
}

useService().catch(console.error);
