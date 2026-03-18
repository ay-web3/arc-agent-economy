import axios from 'axios';

export interface ArcManagedConfig {
    orchestratorUrl: string; // The URL of the Swarm Master API
    agentId: string;         // The unique ID assigned to this agent
}

/**
 * @title ArcManagedSDK
 * @dev The "Zero-Secret" SDK for agents. 
 * This agent holds NO private keys, NO entity secrets, and NO API keys.
 * It simply sends work requests to the Swarm Master (Orchestrator).
 */
export class ArcManagedSDK {
    private orchestratorUrl: string;
    private agentId: string;

    constructor(config: ArcManagedConfig) {
        this.orchestratorUrl = config.orchestratorUrl;
        this.agentId = config.agentId;
    }

    private async requestAction(action: string, params: any) {
        const response = await axios.post(`${this.orchestratorUrl}/execute`, {
            agentId: this.agentId,
            action: action,
            params: params
        });
        return response.data;
    }

    async registerAsSeller(capHash: string, pubKey: string, stake: string) {
        return this.requestAction("register", { asSeller: true, capHash, pubKey, stake });
    }

    async placeBid(taskId: string, price: string) {
        return this.requestAction("placeBid", { taskId, price });
    }

    async submitResult(taskId: string, hash: string, uri: string) {
        return this.requestAction("submitResult", { taskId, hash, uri });
    }
}
