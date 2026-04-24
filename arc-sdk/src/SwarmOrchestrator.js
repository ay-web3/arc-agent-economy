import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import { v4 as uuidv4 } from 'uuid';
import { encodeFunctionData } from 'viem';

/**
 * @title SwarmOrchestrator
 * @dev The "Swarm Master" logic. 
 * This is the ONLY component that holds the Circle API Key and Entity Secret.
 * It listens to requests from "Zero-Secret" agents and executes them on their behalf.
 */
export class SwarmOrchestrator {
    client;
    gateway;
    registryAddress;
    escrowAddress;
    treasuryAddress;

    constructor(config) {
        this.client = initiateDeveloperControlledWalletsClient({ 
            apiKey: config.apiKey, 
            entitySecret: config.entitySecret 
        });
        if (config.gateway) {
            this.gateway = config.gateway;
        }
        this.registryAddress = config.registryAddress;
        this.escrowAddress = config.escrowAddress;
        this.treasuryAddress = config.treasuryAddress;
    }

    setGateway(gateway) {
        this.gateway = gateway;
    }

    padBytes32(hex) {
        if (!hex || hex === "0x") return "0x" + "0".repeat(64);
        if (!hex.startsWith("0x")) hex = "0x" + hex;
        if (hex.length >= 66) return hex.slice(0, 66);
        return hex + "0".repeat(66 - hex.length);
    }

    async executeForAgent(agentWalletId, action, params) {
        console.log(`>> [ORCHESTRATOR] Executing ${action} for Wallet ${agentWalletId}. Params:`, JSON.stringify(params));
        
        let contract = "";
        let amount = "0";
        let signature = null;
        let abiParams = null;
        let callData = null;

        switch(action) {
            case "register":
                contract = this.registryAddress;
                signature = "register(bool,bool,bytes32,bytes32)";
                abiParams = [
                    params.asSeller === true || params.asSeller === "true", 
                    params.asVerifier === true || params.asVerifier === "true", 
                    this.padBytes32(params.capHash), 
                    this.padBytes32(params.pubKey)
                ];
                amount = params.stake || "0";
                break;

            case "updateProfile":
                contract = this.registryAddress;
                signature = "updateProfile(bytes32,bytes32,bool)";
                abiParams = [
                    this.padBytes32(params.capHash), 
                    this.padBytes32(params.pubKey), 
                    true
                ];
                break;

            case "createOpenTask":
                // 🛡️ Special Case: Use callData for array-based parameters to bypass Circle packer limitations
                contract = this.escrowAddress;
                let verifiers = params.verifiers || [];
                if (typeof verifiers === 'string') verifiers = [verifiers];
                if (!Array.isArray(verifiers)) verifiers = [];

                const cotAbi = [{
                    name: "createOpenTask",
                    type: "function",
                    stateMutability: "payable",
                    inputs: [
                        { name: "jobDeadline", type: "uint64" },
                        { name: "bidDeadline", type: "uint64" },
                        { name: "verifierDeadline", type: "uint64" },
                        { name: "taskHash", type: "bytes32" },
                        { name: "verifiers", type: "address[]" },
                        { name: "quorumM", type: "uint8" }
                    ]
                }];
                callData = encodeFunctionData({ 
                    abi: cotAbi, 
                    functionName: "createOpenTask", 
                    args: [
                        BigInt(params.jobDeadline || 0), 
                        BigInt(params.bidDeadline || 0), 
                        BigInt(params.verifierDeadline || 0), 
                        this.padBytes32(params.taskHash), 
                        verifiers, 
                        Number(params.quorumM || 1)
                    ]
                });
                amount = params.value || params.amount || "0";
                break;

            case "placeBid":
                contract = this.escrowAddress;
                signature = "placeBid(uint256,uint256,uint64,bytes32)";
                const bidPriceScaled = params.price ? (BigInt(Math.floor(parseFloat(params.price) * 1e6))).toString() : "0";
                abiParams = [
                    String(params.taskId || 0), 
                    bidPriceScaled, 
                    String(params.eta || 0), 
                    this.padBytes32(params.meta || params.metaHash)
                ];
                break;

            case "selectBid":
                contract = this.escrowAddress;
                signature = "selectBid(uint256,uint256)";
                abiParams = [String(params.taskId || 0), String(params.bidIndex || 0)];
                break;

            case "submitResult":
                contract = this.escrowAddress;
                signature = "submitResult(uint256,bytes32,string)";
                abiParams = [
                    String(params.taskId || 0), 
                    this.padBytes32(params.hash || params.resultHash), 
                    params.uri || params.resultURI || ""
                ];
                break;

            case "approve":
            case "approveTask":
                contract = this.escrowAddress;
                signature = "approve(uint256)";
                abiParams = [String(params.taskId || 0)];
                break;

            case "finalize":
            case "finalizeTask":
                contract = this.escrowAddress;
                signature = "finalize(uint256)";
                abiParams = [String(params.taskId || 0)];
                break;

            case "deposit-nano":
                contract = this.escrowAddress;
                signature = "depositNanoBalance()";
                abiParams = [];
                amount = params.amount || "0";
                break;

            case "withdraw-nano":
                contract = this.escrowAddress;
                signature = "withdrawNanoBalance(uint256)";
                const withdrawNanoScaled = params.amount ? (BigInt(Math.floor(parseFloat(params.amount) * 1e6))).toString() : "0";
                abiParams = [withdrawNanoScaled];
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        const txPayload = {
            idempotencyKey: uuidv4(),
            walletId: agentWalletId,
            blockchain: "ARC-TESTNET",
            contractAddress: contract,
            amount: amount,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        };

        if (callData) {
            txPayload.callData = callData;
        } else {
            txPayload.abiFunctionSignature = signature;
            txPayload.abiParameters = abiParams;
        }

        console.log(`>> [ORCHESTRATOR] Prepared Payload for ${action}. Type: ${callData ? 'callData' : 'abiSignature'}`);
        return this.client.createContractExecutionTransaction(txPayload);
    }

    /**
     * @dev Fulfills a Nano-Payment authorization via the Circle Batcher.
     */
    async executeNanoPayout(recipient, amount) {
        return this.gateway.queuePayment({
            amount: amount,
            recipientAddress: recipient,
            currency: "USDC"
        });
    }
}