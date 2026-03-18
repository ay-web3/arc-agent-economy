import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface ArcCircleConfig {
    apiKey: string;
    entitySecretCiphertext: string;
    walletId: string;
    registryAddress: string;
    escrowAddress: string;
}

/**
 * @title ArcCircleSDK
 * @dev Specialized SDK for agents using Circle Programmable Wallets on ARC Testnet.
 */
export class ArcCircleSDK {
    private apiKey: string;
    private ciphertext: string;
    private walletId: string;
    private registryAddress: string;
    private escrowAddress: string;
    private baseUrl: string = "https://api.circle.com/v1/w3s/developer/transactions";

    constructor(config: ArcCircleConfig) {
        this.apiKey = config.apiKey;
        this.ciphertext = config.entitySecretCiphertext;
        this.walletId = config.walletId;
        this.registryAddress = config.registryAddress;
        this.escrowAddress = config.escrowAddress;
    }

    private async call(contract: string, signature: string, params: any[], amount: string = "0") {
        const response = await axios.post(`${this.baseUrl}/contractExecution`, {
            idempotencyKey: uuidv4(),
            entitySecretCiphertext: this.ciphertext,
            walletId: this.walletId,
            blockchain: "ARC-TESTNET",
            contractAddress: contract,
            abiFunctionSignature: signature,
            abiParameters: params,
            amount: amount,
            feeLevel: "MEDIUM"
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.data;
    }

    async registerAgent(asSeller: boolean, asVerifier: boolean, capHash: string, pubKey: string, stake: string) {
        return this.call(this.registryAddress, "register(bool,bool,bytes32,bytes32)", [asSeller, asVerifier, capHash, pubKey], stake);
    }

    async placeBid(taskId: string, price: string, eta: number, meta: string) {
        return this.call(this.escrowAddress, "placeBid(uint256,uint256,uint64,bytes32)", [taskId, (parseFloat(price) * 10**18).toString(), eta.toString(), meta]);
    }

    async submitResult(taskId: string, hash: string, uri: string) {
        return this.call(this.escrowAddress, "submitResult(uint256,bytes32,string)", [taskId, hash, uri]);
    }

    async approveTask(taskId: string) {
        return this.call(this.escrowAddress, "approve(uint256)", [taskId]);
    }
}
