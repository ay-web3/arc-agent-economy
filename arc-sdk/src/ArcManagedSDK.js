import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, http, parseAbiItem, keccak256, toBytes } from 'viem';
import { arcTestnet } from 'viem/chains';
import crypto from 'crypto';

const IDENTITY_REGISTRY = "0xb7a857a8A2f06901C4e5F6D29EBB4dE479E3ca03";
/**
 * @title ArcManagedSDK
 * @dev Secure SDK with ERC-8004 Identity & Reputation integration.
 */
export class ArcManagedSDK {
    orchestratorUrl = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
    agentId = null;
    agentSecret = null;
    secretPath = path.join(process.cwd(), '.agent_secret');
    publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    constructor(config) {
        if (config) {
            if (config.orchestratorUrl)
                this.orchestratorUrl = config.orchestratorUrl;
            if (config.agentId)
                this.agentId = config.agentId;
            if (config.secretPath)
                this.secretPath = config.secretPath;
        }
        this.loadSecret();
    }
    /**
     * @dev Generates a deterministic Keccak256 hash for task or result metadata.
     */
    generateMetadataHash(metadata) {
        const str = JSON.stringify(metadata, Object.keys(metadata).sort());
        return keccak256(toBytes(str));
    }
    /**
     * @dev Resolves a URI to a human-clickable link.
     */
    resolveEvidenceURI(uri, gateway = "https://ipfs.io/ipfs/") {
        if (uri.startsWith("ipfs://")) {
            return uri.replace("ipfs://", gateway);
        }
        return uri;
    }
    loadSecret() {
        if (fs.existsSync(this.secretPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.secretPath, 'utf8'));
                this.agentId = data.agentId;
                this.agentSecret = data.agentSecret;
            }
            catch (e) {
                console.error("[SDK] Failed to load .agent_secret:", e);
            }
        }
    }
    saveSecret(agentId, agentSecret) {
        fs.writeFileSync(this.secretPath, JSON.stringify({ agentId, agentSecret }, null, 2));
    }
    async requestAction(endpoint, params) {
        if (!this.agentId && endpoint !== 'onboard') {
            throw new Error("Agent not onboarded.");
        }
        const response = await axios.post(`${this.orchestratorUrl}/${endpoint}`, {
            agentId: this.agentId,
            agentSecret: this.agentSecret,
            ...params
        });
        return response.data;
    }
    /**
     * @dev Polls the Hub for the real on-chain status of a transaction.
     * Circle returns 200 OK immediately, but the tx can fail asynchronously.
     * This method waits until the tx reaches a terminal state (COMPLETE or FAILED).
     */
    async waitForTx(txId, maxAttempts = 15, intervalMs = 4000) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const resp = await axios.get(`${this.orchestratorUrl}/tx-status/${txId}`);
                const { state, errorReason, txHash } = resp.data;
                if (state === 'COMPLETE' || state === 'CONFIRMED') {
                    return { success: true, state, txHash };
                }
                if (state === 'FAILED' || state === 'CANCELLED' || state === 'DENIED') {
                    throw new Error(`Transaction FAILED on-chain: ${errorReason || state}`);
                }
                // Still pending, wait and retry
                await new Promise(r => setTimeout(r, intervalMs));
            } catch (e) {
                if (e.message.startsWith('Transaction FAILED')) throw e;
                // Network error, retry
                await new Promise(r => setTimeout(r, intervalMs));
            }
        }
        throw new Error(`Transaction ${txId} timed out after ${maxAttempts * intervalMs / 1000}s`);
    }
    /**
     * @dev Execute a contract action and wait for on-chain confirmation.
     * Returns only when the transaction has been confirmed or throws on failure.
     */
    async executeAndWait(endpoint, params) {
        const result = await this.requestAction(endpoint, params);
        const txId = result.txId;
        if (!txId) return result;
        console.log(`[SDK] Tx submitted: ${txId}. Polling for on-chain result...`);
        const status = await this.waitForTx(txId);
        console.log(`[SDK] ✅ Tx CONFIRMED on-chain: ${status.txHash || txId}`);
        return { ...result, ...status };
    }
    /**
     * @dev Onboards the agent, mints an ARC Identity NFT, and secures the wallet.
     */
    async selfOnboard(agentName, metadataURI) {
        console.log(`[SDK] Secure Onboarding & Identity Minting for: ${agentName}`);
        const data = await this.requestAction("onboard", { agentName, metadataURI });
        if (data.agentSecret && data.agentId) {
            this.agentId = data.agentId;
            this.agentSecret = data.agentSecret;
            this.saveSecret(this.agentId, this.agentSecret);
            console.log(`[SDK] identity secured. Waiting for ARC Identity NFT mint...`);
            // Attempt to find the minted Token ID
            setTimeout(() => this.syncArcIdentity(data.address), 10000);
        }
        return data;
    }
    async syncArcIdentity(address) {
        try {
            const logs = await this.publicClient.getLogs({
                address: IDENTITY_REGISTRY,
                event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
                args: { to: address },
                fromBlock: 'latest'
            });
            if (logs && logs.length > 0) {
                const lastLog = logs[logs.length - 1];
                if (lastLog && lastLog.args && lastLog.args.tokenId) {
                    const tokenId = lastLog.args.tokenId.toString();
                    await this.requestAction("updateArcIdentity", { tokenId });
                    console.log(`[SDK] ERC-8004 Identity Linked: Token #${tokenId}`);
                }
            }
        }
        catch (e) {
            console.error("Identity sync failed:", e);
        }
    }
    async fuelAgent(address) {
        const response = await axios.get(`${this.orchestratorUrl}/admin/fuel-agent/${address}`);
        return response.data;
    }
    // --- READ ACTIONS ---
    async getTask(id) {
        const response = await axios.get(`${this.orchestratorUrl}/escrow/task/${id}`);
        return response.data;
    }
    async getTaskCounter() {
        const response = await axios.get(`${this.orchestratorUrl}/escrow/counter`);
        return response.data.count;
    }
    async getAgentProfile(address) {
        const response = await axios.get(`${this.orchestratorUrl}/registry/profile/${address}`);
        return response.data;
    }
    async getAgents() {
        return this.requestAction("agents", {});
    }
    // --- AGENT REGISTRY ACTIONS ---
    async registerAgent(params) {
        const payload = { ...params };
        
        // Auto-generate crypto parameters so agents don't have the stress of handling them
        if (params.capabilities && !params.capHash) {
            payload.capHash = crypto.createHash('sha256').update(params.capabilities).digest('hex');
        } else if (!params.capHash) {
            payload.capHash = crypto.createHash('sha256').update("Default Capabilities").digest('hex');
        }

        if (!params.pubKey) {
            payload.pubKey = crypto.randomBytes(32).toString('hex');
        }

        return this.executeAndWait("execute/register", payload);
    }
    async updateProfile(params) {
        return this.requestAction("execute/updateProfile", params);
    }
    async setRoles(params) {
        return this.requestAction("execute/setRoles", params);
    }
    async topUpStake(amount) {
        return this.requestAction("execute/topUpStake", { amount });
    }
    async requestWithdraw(amount) {
        return this.requestAction("execute/withdraw/request", { amount });
    }
    async cancelWithdraw() {
        return this.requestAction("execute/withdraw/cancel", {});
    }
    async completeWithdraw() {
        return this.requestAction("execute/withdraw/complete", {});
    }
    /**
     * @dev Engine A: Create a high-value Task on the ARC Testnet.
     * Requires native USDC escrow.
     */
    async createOpenTask(params) {
        const amount = params.amount || params.value;
        const payload = {
            jobDeadline: params.jobDeadline,
            bidDeadline: params.bidDeadline,
            verifierDeadline: params.verifierDeadline,
            taskHash: params.taskHash,
            verifiers: params.verifiers,
            quorumM: params.quorumM,
            amount: amount,
            value: amount
        };
        return this.executeAndWait("execute/createOpenTask", payload);
    }
    async selectBid(params) {
        const index = params.bidIndex !== undefined ? params.bidIndex : 0;
        return this.executeAndWait("execute/selectBid", { taskId: params.taskId, bidIndex: index });
    }
    async finalizeAuction(taskId) {
        return this.requestAction("execute/finalizeAuction", { taskId });
    }
    async cancelIfNoBids(taskId) {
        return this.requestAction("execute/cancelIfNoBids", { taskId });
    }
    async timeoutRefund(taskId) {
        return this.requestAction("execute/timeoutRefund", { taskId });
    }
    async verifierTimeoutRefund(taskId) {
        return this.requestAction("execute/verifierTimeoutRefund", { taskId });
    }
    async openDispute(taskId) {
        return this.requestAction("execute/openDispute", { taskId });
    }
    // --- SELLER ACTIONS ---
    async placeBid(params) {
        return this.executeAndWait("execute/placeBid", params);
    }
    async submitResult(params) {
        const hash = params.hash || params.resultHash;
        const uri = params.uri || params.resultURI;
        const payload = {
            taskId: params.taskId,
            hash: hash,
            resultHash: hash,
            uri: uri,
            resultURI: uri
        };
        return this.executeAndWait("execute/submitResult", payload);
    }
    // --- VERIFIER ACTIONS ---
    async approveTask(params) {
        const id = typeof params === 'object' ? params.taskId : params;
        return this.executeAndWait("execute/approve", { taskId: id });
    }
    async approveWork(params) {
        return this.approveTask(params);
    }
    async rejectTask(taskId) {
        return this.requestAction("execute/reject", { taskId });
    }
    // --- KEEPER / SYSTEM ACTIONS ---
    async finalizeTask(taskId) {
        return this.executeAndWait("execute/finalize", { taskId });
    }
    // --- GOVERNANCE ACTIONS ---
    async setSellerSlashBps(bps) {
        return this.requestAction("execute/setSellerSlashBps", { bps });
    }
    async resolveDispute(params) {
        return this.requestAction("execute/resolveDispute", params);
    }

    // ================= OFF-CHAIN NANO METHODS =================
    
    async depositNanoBalance(amount) {
        return await this.executeAndWait("deposit-nano", { amount });
    }

    async createNanoTask(params) {
        const response = await axios.post(`${this.orchestratorUrl}/nano/create`, {
            ...params,
            buyerAddress: this.agentId // For demo mapping
        });
        return response.data;
    }

    async placeNanoBid(params) {
        const response = await axios.post(`${this.orchestratorUrl}/nano/bid`, {
            ...params,
            sellerAddress: this.agentId
        });
        return response.data;
    }

    async selectNanoBid(params) {
        const response = await axios.post(`${this.orchestratorUrl}/nano/select`, params);
        return response.data;
    }

    async submitNanoResult(params) {
        const response = await axios.post(`${this.orchestratorUrl}/nano/submit`, params);
        return response.data;
    }

    async approveNanoTask(params) {
        const response = await axios.post(`${this.orchestratorUrl}/nano/approve`, {
            ...params,
            verifierAddress: this.agentId
        });
        return response.data;
    }
}
//# sourceMappingURL=ArcManagedSDK.js.map