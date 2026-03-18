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

    // --- Identity ---
    async registerAgent(params: { asSeller: boolean, asVerifier: boolean, capHash: string, pubKey: string, stake: string }) {
        return this.requestAction("register", params);
    }

    async updateProfile(capHash: string, pubKey: string) {
        return this.requestAction("updateProfile", { capHash, pubKey });
    }

    // --- Buyer ---
    async createOpenTask(params: { jobDeadline: number, bidDeadline: number, taskHash: string, verifiers: string[], quorumM: number, amount: string }) {
        return this.requestAction("createOpenTask", params);
    }

    async selectBid(taskId: string, bidIndex: number) {
        return this.requestAction("selectBid", { taskId, bidIndex });
    }

    async timeoutRefund(taskId: string) {
        return this.requestAction("timeoutRefund", { taskId });
    }

    async openDispute(taskId: string) {
        return this.requestAction("openDispute", { taskId });
    }

    async cancelIfNoBids(taskId: string) {
        return this.requestAction("cancelIfNoBids", { taskId });
    }

    // --- Seller ---
    async placeBid(taskId: string, price: string, eta: number = 3600, meta: string = "0x0000000000000000000000000000000000000000000000000000000000000000") {
        return this.requestAction("placeBid", { taskId, price, eta, meta });
    }

    async submitResult(taskId: string, hash: string, uri: string) {
        return this.requestAction("submitResult", { taskId, hash, uri });
    }

    // --- Verifier ---
    async approveTask(taskId: string) {
        return this.requestAction("approveTask", { taskId });
    }

    // --- Settlement ---
    async finalizeTask(taskId: string) {
        return this.requestAction("finalizeTask", { taskId });
    }

    // --- Exit Flow ---
    async requestWithdraw(amount: string) {
        return this.requestAction("requestWithdraw", { amount });
    }

    async completeWithdraw() {
        return this.requestAction("completeWithdraw", {});
    }

    async cancelWithdraw() {
        return this.requestAction("cancelWithdraw", {});
    }

    // --- Intelligence (Read-only calls can be direct to RPC or via Orchestrator) ---
    async getTask(taskId: string) {
        return this.requestAction("getTask", { taskId });
    }
}
