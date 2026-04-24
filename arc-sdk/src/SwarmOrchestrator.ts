import { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { GatewayClient } from '@circle-fin/x402-batching/client';
import { v4 as uuidv4 } from 'uuid';

export interface SwarmMasterConfig {
    apiKey: string;
    entitySecret: string;
    privateKey: string;
    registryAddress: string;
    escrowAddress: string;
    gatewayAddress: string; // New: Circle Gateway for Batching
    treasuryAddress: string; // New: Destination for protocol fees
}

/**
 * @title SwarmOrchestrator
 * @dev The "Swarm Master" logic. 
 * This is the ONLY component that holds the Circle API Key and Entity Secret.
 * It listens to requests from "Zero-Secret" agents and executes them on their behalf.
 */
export class SwarmOrchestrator {
    private client: CircleDeveloperControlledWalletsClient;
    private gateway: GatewayClient;
    private registryAddress: string;
    private escrowAddress: string;
    private treasuryAddress: string;

    constructor(config: SwarmMasterConfig) {
        this.client = new CircleDeveloperControlledWalletsClient(config.apiKey, config.entitySecret);
        this.gateway = new GatewayClient({ 
            gatewayAddress: config.gatewayAddress,
            privateKey: config.privateKey,
            chain: "arcTestnet" 
        });
        this.registryAddress = config.registryAddress;
        this.escrowAddress = config.escrowAddress;
        this.treasuryAddress = config.treasuryAddress;
    }

    async executeForAgent(agentWalletId: string, action: string, params: any) {
        let signature = "";
        let contract = "";
        let abiParams: any[] = [];
        let amount = "0";

        switch(action) {
            case "register":
                contract = this.registryAddress;
                signature = "register(bool,bool,bytes32,bytes32)";
                abiParams = [params.asSeller, params.asVerifier, params.capHash, params.pubKey];
                amount = params.stake;
                break;
            case "updateProfile":
                contract = this.registryAddress;
                signature = "updateProfile(bytes32,bytes32,bool)";
                abiParams = [params.capHash, params.pubKey, true];
                break;
            case "createOpenTask":
                contract = this.escrowAddress;
                signature = "createOpenTask(uint64,uint64,uint64,bytes32,address[],uint8)";
                abiParams = [params.jobDeadline, params.bidDeadline, params.verifierDeadline, params.taskHash, params.verifiers, params.quorumM];
                amount = params.value || params.amount || "0";
                break;
            case "placeBid":
                contract = this.escrowAddress;
                signature = "placeBid(uint256,uint256,uint64,bytes32)";
                abiParams = [params.taskId, (BigInt(Math.floor(parseFloat(params.price) * 1e6))).toString(), params.eta.toString(), params.meta];
                break;
            case "selectBid":
                contract = this.escrowAddress;
                signature = "selectBid(uint256,uint256)";
                abiParams = [params.taskId, params.bidIndex];
                break;
            case "submitResult":
                contract = this.escrowAddress;
                signature = "submitResult(uint256,bytes32,string)";
                abiParams = [params.taskId, params.hash, params.uri];
                break;
            case "approveTask":
                contract = this.escrowAddress;
                signature = "approve(uint256)";
                abiParams = [params.taskId];
                break;
            case "finalizeTask":
                contract = this.escrowAddress;
                signature = "finalize(uint256)";
                abiParams = [params.taskId];
                break;
            case "timeoutRefund":
                contract = this.escrowAddress;
                signature = "timeoutRefund(uint256)";
                abiParams = [params.taskId];
                break;
            case "requestWithdraw":
                contract = this.registryAddress;
                signature = "requestWithdraw(uint256)";
                abiParams = [(BigInt(Math.floor(parseFloat(params.amount) * 1e6))).toString()];
                break;
            case "topUpStake":
                contract = this.registryAddress;
                signature = "topUpStake()";
                abiParams = [];
                amount = params.amount;
                break;
            case "completeWithdraw":
                contract = this.registryAddress;
                signature = "completeWithdraw()";
                abiParams = [];
                break;
            default:
                throw new Error("Unknown action");
        }

        return (this.client as any).createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: agentWalletId,
            blockchain: "ARC-TESTNET",
            contractAddress: contract,
            abiFunctionSignature: signature,
            abiParameters: abiParams,
            amount: amount,
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });
    }

    /**
     * @dev Fulfills a Nano-Payment authorization via the Circle Batcher.
     */
    async executeNanoPayout(recipient: string, amount: string) {
        return this.gateway.queuePayment({
            amount: amount,
            recipientAddress: recipient,
            currency: "USDC"
        });
    }
}
