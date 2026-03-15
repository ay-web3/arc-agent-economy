import { ethers, Contract } from "ethers";
import { ArcSDKConfig, AgentProfile, Task, TaskState } from "./types";

const REGISTRY_ABI = [
    "function register(bool asSeller, bool asVerifier, bytes32 capabilitiesHash, bytes32 pubKey) external payable",
    "function updateProfile(bytes32 capabilitiesHash, bytes32 pubKey, bool active) external",
    "function topUpStake() external payable",
    "function requestWithdraw(uint256 amount) external",
    "function completeWithdraw() external",
    "function profile(address agent) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)",
    "function stakeOf(address agent) external view returns (uint256)",
    "function availableStake(address agent) external view returns (uint256)",
    "function isSeller(address agent) external view returns (bool)",
    "function isVerifier(address agent) external view returns (bool)"
];

const ESCROW_ABI = [
    "function createOpenTask(uint64 jobDeadline, uint64 bidDeadline, bytes32 taskHash, address[] verifiers, uint8 quorumM) external payable returns (uint256)",
    "function placeBid(uint256 taskId, uint256 bidPrice, uint64 etaSeconds, bytes32 metaHash) external",
    "function selectBid(uint256 taskId, uint256 bidIndex) external",
    "function finalizeAuction(uint256 taskId) external",
    "function submitResult(uint256 taskId, bytes32 resultHash, string resultURI) external",
    "function approve(uint256 taskId) external",
    "function finalize(uint256 taskId) external",
    "function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)",
    "function taskCounter() external view returns (uint256)"
];

export class ArcEconomySDK {
    private registry: Contract;
    private escrow: Contract;
    private signer?: ethers.Signer;

    constructor(config: ArcSDKConfig) {
        this.signer = config.signer;
        this.registry = new Contract(config.registryAddress, REGISTRY_ABI, this.signer || config.provider);
        this.escrow = new Contract(config.escrowAddress, ESCROW_ABI, this.signer || config.provider);
    }

    // --- Agent Actions ---

    async registerAgent(params: {
        asSeller: boolean,
        asVerifier: boolean,
        capabilitiesHash: string,
        pubKey: string,
        stakeAmount?: string
    }) {
        const value = params.stakeAmount ? ethers.parseEther(params.stakeAmount) : 0n;
        return this.registry.register(
            params.asSeller,
            params.asVerifier,
            params.capabilitiesHash,
            params.pubKey,
            { value }
        );
    }

    async getAgentProfile(address: string): Promise<AgentProfile> {
        const [active, capabilitiesHash, pubKey] = await this.registry.profile(address);
        return { active, capabilitiesHash, pubKey };
    }

    async getStake(address: string) {
        return this.registry.stakeOf(address);
    }

    // --- Buyer Actions ---

    async createOpenTask(params: {
        jobDeadline: number,
        bidDeadline: number,
        taskHash: string,
        verifiers: string[],
        quorumM: number,
        amount: string
    }) {
        const value = ethers.parseEther(params.amount);
        return this.escrow.createOpenTask(
            params.jobDeadline,
            params.bidDeadline,
            params.taskHash,
            params.verifiers,
            params.quorumM,
            { value }
        );
    }

    // --- Seller Actions ---

    async placeBid(taskId: string | number, bidPrice: string, etaSeconds: number = 0, metaHash: string = ethers.ZeroHash) {
        return this.escrow.placeBid(taskId, ethers.parseEther(bidPrice), etaSeconds, metaHash);
    }

    async submitResult(taskId: string | number, resultHash: string, resultURI: string) {
        return this.escrow.submitResult(taskId, resultHash, resultURI);
    }

    // --- Verifier Actions ---

    async approveTask(taskId: string | number) {
        return this.escrow.approve(taskId);
    }

    // --- Finalization ---

    async finalizeTask(taskId: string | number) {
        return this.escrow.finalize(taskId);
    }

    async selectBid(taskId: string | number, bidIndex: number) {
        return this.escrow.selectBid(taskId, bidIndex);
    }

    // --- Global/Misc ---

    async getTask(taskId: string | number): Promise<Task> {
        const t = await this.escrow.tasks(taskId);
        return {
            buyer: t.buyer,
            seller: t.seller,
            price: t.price,
            verifierPool: t.verifierPool,
            sellerBudget: t.sellerBudget,
            deadline: t.deadline,
            bidDeadline: t.bidDeadline,
            taskHash: t.taskHash,
            resultHash: t.resultHash,
            resultURI: t.resultURI,
            state: Number(t.state) as TaskState,
            quorumM: Number(t.quorumM),
            quorumN: Number(t.quorumN)
        };
    }
}
