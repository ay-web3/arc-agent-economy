import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface ArcManagedConfig {
    orchestratorUrl?: string; // Optional: Overrides default orchestrator
    agentId?: string;         // The unique ID (optional if self-onboarding)
}

/**
 * @title ArcManagedSDK
 * @dev The "Zero-Secret" SDK for agents. 
 * This agent holds NO private keys and NO API credentials locally.
 * It uses a locally stored agentSecret (one-time generation) for secure API calls.
 */
export class ArcManagedSDK {
    private orchestratorUrl: string = "http://YOUR-BACKEND-IP-HERE:3001";
    private agentId: string | null = null;
    private agentSecret: string | null = null;
    private secretPath: string = path.join(process.cwd(), '.agent_secret');

    constructor(config?: ArcManagedConfig) {
        if (config) {
            if (config.orchestratorUrl) this.orchestratorUrl = config.orchestratorUrl;
            if (config.agentId) this.agentId = config.agentId;
        }
        this.loadSecret();
    }

    private loadSecret() {
        if (fs.existsSync(this.secretPath)) {
            const data = JSON.parse(fs.readFileSync(this.secretPath, 'utf8'));
            this.agentId = data.agentId;
            this.agentSecret = data.agentSecret;
        }
    }

    private saveSecret(agentId: string, agentSecret: string) {
        fs.writeFileSync(this.secretPath, JSON.stringify({ agentId, agentSecret }, null, 2));
    }

    private async requestAction(endpoint: string, params: any) {
        if (!this.agentId && endpoint !== 'onboard') {
            throw new Error("Agent not onboarded. Call selfOnboard() first or provide agentId in config.");
        }

        const response = await axios.post(`${this.orchestratorUrl}/${endpoint}`, {
            agentId: this.agentId,
            agentSecret: this.agentSecret,
            ...params
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    }

    /**
     * @dev Automatically requests a new identity and generates a secure local secret.
     */
    async selfOnboard(agentName: string) {
        console.log(`[SDK] Requesting secure onboarding for: ${agentName}`);
        const data = await this.requestAction("onboard", { agentName });
        
        if (data.agentSecret) {
            this.agentId = data.agentId;
            this.agentSecret = data.agentSecret;
            this.saveSecret(this.agentId!, this.agentSecret);
            console.log(`[SDK] Identity Secured. Local secret saved to .agent_secret`);
        }
        return data;
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

    async setSellerSlashBps(bps: number) {
        return this.requestAction("execute/setSellerSlashBps", { bps });
    }

    async resolveDispute(params: { taskId: string, ruling: number, buyerBps: number }) {
        return this.requestAction("execute/resolveDispute", params);
    }
}
