import axios from 'axios';

export interface ArcManagedConfig {
    orchestratorUrl: string; // The URL of the Swarm Master API
    agentId?: string;        // The unique ID (optional if self-onboarding)
    authToken?: string;      // Optional: Bearer token for authentication
}

/**
 * @title ArcManagedSDK
 * @dev The "Zero-Secret" SDK for agents. 
 * This agent holds NO private keys, NO entity secrets, and NO API keys.
 * It simply sends work requests to the Swarm Master (Orchestrator).
 */
export class ArcManagedSDK {
    private orchestratorUrl: string = "http://YOUR-BACKEND-IP-HERE:3001";
    private agentId: string | null = null;
    private authToken: string | null = null;

    constructor(config?: ArcManagedConfig) {
        if (config) {
            if (config.orchestratorUrl) this.orchestratorUrl = config.orchestratorUrl;
            if (config.agentId) this.agentId = config.agentId;
            if (config.authToken) this.authToken = config.authToken;
        }
    }

    private async requestAction(endpoint: string, params: any) {
        if (!this.agentId && endpoint !== 'onboard') {
            throw new Error("Agent not onboarded. Call selfOnboard() first or provide agentId in config.");
        }

        const headers: any = { 'Content-Type': 'application/json' };
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const response = await axios.post(`${this.orchestratorUrl}/${endpoint}`, {
            agentId: this.agentId,
            ...params
        }, { headers });

        return response.data;
    }

    /**
     * @dev Automatically requests a new wallet identity from the Orchestrator.
     */
    async selfOnboard(agentName: string) {
        console.log(`[SDK] Requesting autonomous onboarding for: ${agentName}`);
        const data = await this.requestAction("onboard", { agentName });
        if (data.success) {
            this.agentId = data.agentId;
            console.log(`[SDK] Identity Secured. Agent ID: ${this.agentId}, Address: ${data.address}`);
        }
        return data;
    }

    async getAgents() {
        return this.requestAction("agents", {});
    }

    // --- AGENT REGISTRY ACTIONS ---

    async registerAgent(params: { asSeller: boolean, asVerifier: boolean, capHash: string, pubKey: string, stake: string }) {
        return this.requestAction("execute/register", params);
    }

    async updateProfile(params: { capHash: string, pubKey: string, active: boolean }) {
        return this.requestAction("execute/updateProfile", params);
    }

    async setRoles(params: { wantSeller: boolean, wantVerifier: boolean }) {
        return this.requestAction("execute/setRoles", params);
    }

    async topUpStake(amount: string) {
        return this.requestAction("execute/topUpStake", { amount });
    }

    async requestWithdraw(amount: string) {
        return this.requestAction("execute/withdraw/request", { amount });
    }

    async cancelWithdraw() {
        return this.requestAction("execute/withdraw/cancel", {});
    }

    async completeWithdraw() {
        return this.requestAction("execute/withdraw/complete", {});
    }

    // --- BUYER ACTIONS ---

    async createOpenTask(params: { 
        jobDeadline: number, 
        bidDeadline: number, 
        verifierDeadline: number,
        taskHash: string, 
        verifiers: string[], 
        quorumM: number, 
        amount: string 
    }) {
        return this.requestAction("execute/createOpenTask", params);
    }

    async selectBid(taskId: string, bidIndex: number) {
        return this.requestAction("execute/selectBid", { taskId, bidIndex });
    }

    async finalizeAuction(taskId: string) {
        return this.requestAction("execute/finalizeAuction", { taskId });
    }

    async cancelIfNoBids(taskId: string) {
        return this.requestAction("execute/cancelIfNoBids", { taskId });
    }

    async timeoutRefund(taskId: string) {
        return this.requestAction("execute/timeoutRefund", { taskId });
    }

    async verifierTimeoutRefund(taskId: string) {
        return this.requestAction("execute/verifierTimeoutRefund", { taskId });
    }

    async openDispute(taskId: string) {
        return this.requestAction("execute/openDispute", { taskId });
    }

    // --- SELLER ACTIONS ---

    async placeBid(params: { taskId: string, price: string, eta?: number, meta?: string }) {
        return this.requestAction("execute/placeBid", params);
    }

    async submitResult(params: { taskId: string, resultHash: string, resultURI: string }) {
        return this.requestAction("execute/submitResult", params);
    }

    // --- VERIFIER ACTIONS ---

    async approveTask(taskId: string) {
        return this.requestAction("execute/approve", { taskId });
    }

    async rejectTask(taskId: string) {
        return this.requestAction("execute/reject", { taskId });
    }

    // --- KEEPER / SYSTEM ACTIONS ---

    async finalizeTask(taskId: string) {
        return this.requestAction("execute/finalize", { taskId });
    }

    // --- GOVERNANCE ACTIONS ---

    async resolveDispute(params: { taskId: string, ruling: number, buyerBps: number }) {
        return this.requestAction("execute/resolveDispute", params);
    }
}
