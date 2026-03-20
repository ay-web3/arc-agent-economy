import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, http, parseAbiItem, getContract } from 'viem';
import { arcTestnet } from 'viem/chains';

export interface ArcManagedConfig {
    orchestratorUrl?: string; 
    agentId?: string;         
}

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

/**
 * @title ArcManagedSDK
 * @dev Secure SDK with ERC-8004 Identity & Reputation integration.
 */
export class ArcManagedSDK {
    private orchestratorUrl: string = "https://arc-agent-economy-156980607075.europe-west1.run.app";
    private agentId: string | null = null;
    private agentSecret: string | null = null;
    private secretPath: string = path.join(process.cwd(), '.agent_secret');
    private publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

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
     * @dev Onboards the agent, mints an ARC Identity NFT, and secures the wallet.
     */
    async selfOnboard(agentName: string, metadataURI?: string) {
        console.log(`[SDK] Secure Onboarding & Identity Minting for: ${agentName}`);
        const data = await this.requestAction("onboard", { agentName, metadataURI });
        
        if (data.agentSecret) {
            this.agentId = data.agentId;
            this.agentSecret = data.agentSecret;
            this.saveSecret(this.agentId!, this.agentSecret);
            
            console.log(`[SDK] identity secured. Waiting for ARC Identity NFT mint...`);
            // Attempt to find the minted Token ID (simplified for hackathon)
            setTimeout(() => this.syncArcIdentity(data.address), 10000);
        }
        return data;
    }

    private async syncArcIdentity(address: string) {
        try {
            const logs = await this.publicClient.getLogs({
                address: IDENTITY_REGISTRY,
                event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
                args: { to: address as `0x${string}` },
                fromBlock: 'latest'
            });
            if (logs.length > 0) {
                const tokenId = logs[logs.length - 1].args.tokenId!.toString();
                await this.requestAction("updateArcIdentity", { tokenId });
                console.log(`[SDK] ERC-8004 Identity Linked: Token #${tokenId}`);
            }
        } catch (e) { console.error("Identity sync failed:", e); }
    }

    async getReputation(address: string) {
        // In production, this would query the ReputationRegistry contract
        return { score: 95, status: "Verified" };
    }

    // --- Standard Actions ---
    async registerAgent(params: { asSeller: boolean, asVerifier: boolean, capHash: string, pubKey: string, stake: string }) {
        return this.requestAction("execute/register", params);
    }
    async createOpenTask(params: { jobDeadline: number, bidDeadline: number, verifierDeadline: number, taskHash: string, verifiers: string[], quorumM: number, amount: string }) {
        return this.requestAction("execute/createOpenTask", params);
    }
    async placeBid(params: { taskId: string, price: string, eta?: number, meta?: string }) {
        return this.requestAction("execute/placeBid", params);
    }
    async submitResult(params: { taskId: string, resultHash: string, resultURI: string }) {
        return this.requestAction("execute/submitResult", params);
    }
    async approveTask(taskId: string) {
        return this.requestAction("execute/approve", { taskId });
    }
    async finalizeTask(taskId: string) {
        return this.requestAction("execute/finalize", { taskId });
    }
}
