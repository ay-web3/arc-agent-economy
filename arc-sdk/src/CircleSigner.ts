import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface CircleSignerConfig {
    apiKey: string;
    entitySecretCiphertext: string;
    walletId: string;
}

/**
 * @title CircleSigner
 * @dev A helper class to route transaction requests through Circle's Secure API.
 */
export class CircleSigner {
    private apiKey: string;
    private ciphertext: string;
    private walletId: string;
    private baseUrl: string = "https://api.circle.com/v1/w3s/developer/transactions";

    constructor(config: CircleSignerConfig) {
        this.apiKey = config.apiKey;
        this.ciphertext = config.entitySecretCiphertext;
        this.walletId = config.walletId;
    }

    async executeContractCall(params: {
        contractAddress: string;
        abiFunctionSignature: string;
        abiParameters: any[];
        amount?: string;
    }) {
        const response = await axios.post(`${this.baseUrl}/contractExecution`, {
            idempotencyKey: uuidv4(),
            entitySecretCiphertext: this.ciphertext,
            walletId: this.walletId,
            blockchain: "ARC-TESTNET",
            contractAddress: params.contractAddress,
            abiFunctionSignature: params.abiFunctionSignature,
            abiParameters: params.abiParameters,
            amount: params.amount || "0",
            feeLevel: "MEDIUM"
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.data;
    }
}
