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
        this.gateway = new GatewayClient({ 
            gatewayAddress: config.gatewayAddress,
            privateKey: config.privateKey,
            chain: "arcTestnet" 
        });
        this.registryAddress = config.registryAddress;
        this.escrowAddress = config.escrowAddress;
        this.treasuryAddress = config.treasuryAddress;
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
        let abi = [];
        let functionName = "";
        let args = [];

        switch(action) {
            case "register":
                contract = this.registryAddress;
                functionName = "register";
                abi = [{
                    name: "register",
                    type: "function",
                    stateMutability: "payable",
                    inputs: [
                        { name: "asSeller", type: "bool" },
                        { name: "asVerifier", type: "bool" },
                        { name: "capabilitiesHash", type: "bytes32" },
                        { name: "pubKey", type: "bytes32" }
                    ]
                }];
                args = [
                    params.asSeller === true || params.asSeller === "true", 
                    params.asVerifier === true || params.asVerifier === "true", 
                    this.padBytes32(params.capHash), 
                    this.padBytes32(params.pubKey)
                ];
                amount = params.stake || "0";
                break;

            case "updateProfile":
                contract = this.registryAddress;
                functionName = "updateProfile";
                abi = [{
                    name: "updateProfile",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [
                        { name: "capabilitiesHash", type: "bytes32" },
                        { name: "pubKey", type: "bytes32" },
                        { name: "active", type: "bool" }
                    ]
                }];
                args = [
                    this.padBytes32(params.capHash), 
                    this.padBytes32(params.pubKey), 
                    true
                ];
                break;

            case "createOpenTask":
                contract = this.escrowAddress;
                functionName = "createOpenTask";
                abi = [{
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
                let verifiers = params.verifiers || [];
                if (typeof verifiers === 'string') verifiers = [verifiers];
                if (!Array.isArray(verifiers)) verifiers = [];

                args = [
                    BigInt(params.jobDeadline || 0), 
                    BigInt(params.bidDeadline || 0), 
                    BigInt(params.verifierDeadline || 0), 
                    this.padBytes32(params.taskHash), 
                    verifiers, 
                    Number(params.quorumM || 1)
                ];
                amount = params.value || params.amount || "0";
                break;

            case "placeBid":
                contract = this.escrowAddress;
                functionName = "placeBid";
                abi = [{
                    name: "placeBid",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [
                        { name: "taskId", type: "uint256" },
                        { name: "bidPrice", type: "uint256" },
                        { name: "etaSeconds", type: "uint64" },
                        { name: "metaHash", type: "bytes32" }
                    ]
                }];
                const bidPriceScaled = params.price ? BigInt(Math.floor(parseFloat(params.price) * 1e6)) : 0n;
                args = [
                    BigInt(params.taskId || 0), 
                    bidPriceScaled, 
                    BigInt(params.eta || 0), 
                    this.padBytes32(params.meta || params.metaHash)
                ];
                break;

            case "selectBid":
                contract = this.escrowAddress;
                functionName = "selectBid";
                abi = [{
                    name: "selectBid",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [
                        { name: "taskId", type: "uint256" },
                        { name: "bidIndex", type: "uint256" }
                    ]
                }];
                args = [BigInt(params.taskId || 0), BigInt(params.bidIndex || 0)];
                break;

            case "submitResult":
                contract = this.escrowAddress;
                functionName = "submitResult";
                abi = [{
                    name: "submitResult",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [
                        { name: "taskId", type: "uint256" },
                        { name: "resultHash", type: "bytes32" },
                        { name: "resultURI", type: "string" }
                    ]
                }];
                args = [
                    BigInt(params.taskId || 0), 
                    this.padBytes32(params.hash || params.resultHash), 
                    params.uri || params.resultURI || ""
                ];
                break;

            case "approve":
            case "approveTask":
                contract = this.escrowAddress;
                functionName = "approve";
                abi = [{
                    name: "approve",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [{ name: "taskId", type: "uint256" }]
                }];
                args = [BigInt(params.taskId || 0)];
                break;

            case "finalize":
            case "finalizeTask":
                contract = this.escrowAddress;
                functionName = "finalize";
                abi = [{
                    name: "finalize",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [{ name: "taskId", type: "uint256" }]
                }];
                args = [BigInt(params.taskId || 0)];
                break;

            case "deposit-nano":
                contract = this.escrowAddress;
                functionName = "depositNanoBalance";
                abi = [{
                    name: "depositNanoBalance",
                    type: "function",
                    stateMutability: "payable",
                    inputs: []
                }];
                args = [];
                amount = params.amount || "0";
                break;

            case "withdraw-nano":
                contract = this.escrowAddress;
                functionName = "withdrawNanoBalance";
                abi = [{
                    name: "withdrawNanoBalance",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [{ name: "amount", type: "uint256" }]
                }];
                const withdrawNanoScaled = params.amount ? BigInt(Math.floor(parseFloat(params.amount) * 1e6)) : 0n;
                args = [withdrawNanoScaled];
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        const callData = encodeFunctionData({ abi, functionName, args });
        console.log(`>> [ORCHESTRATOR] Encoded CallData for ${action}: ${callData}`);

        return this.client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agentWalletId,
            blockchain: "ARC-TESTNET",
            contractAddress: contract,
            callData: callData,
            amount: amount,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });
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