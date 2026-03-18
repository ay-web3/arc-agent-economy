import { ethers, Contract } from "ethers";
import { ArcSDKConfig, AgentProfile, Task, TaskState } from "./types";
import { CircleSigner } from "./CircleSigner";

const REGISTRY_ABI = [
    "function register(bool asSeller, bool asVerifier, bytes32 capabilitiesHash, bytes32 pubKey) external payable",
    "function updateProfile(bytes32 capabilitiesHash, bytes32 pubKey, bool active) external",
    "function topUpStake() external payable",
    "function requestWithdraw(uint256 amount) external",
    "function completeWithdraw() external",
    "function cancelWithdraw() external",
    "function profile(address agent) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)",
    "function stakeOf(address agent) external view returns (uint256)",
    "function availableStake(address agent) external view returns (uint256)",
    "function lockedStakeOf(address agent) external view returns (uint256)",
    "function isSeller(address agent) external view returns (bool)",
    "function isVerifier(address agent) external view returns (bool)",
    "function pendingWithdrawReadyAt(address agent) external view returns (uint256)",
    "function setMinStakes(uint256, uint256) external"
];

const ESCROW_ABI = [
    "function createOpenTask(uint64 jobDeadline, uint64 bidDeadline, bytes32 taskHash, address[] verifiers, uint8 quorumM) external payable returns (uint256)",
    "function placeBid(uint256 taskId, uint256 bidPrice, uint64 etaSeconds, bytes32 metaHash) external",
    "function selectBid(uint256 taskId, uint256 bidIndex) external",
    "function finalizeAuction(uint256 taskId) external",
    "function submitResult(uint256 taskId, bytes32 resultHash, string resultURI) external",
    "function approve(uint256 taskId) external",
    "function finalize(uint256 taskId) external",
    "function timeoutRefund(uint256 taskId) external",
    "function openDispute(uint256 taskId) external",
    "function cancelIfNoBids(uint256 taskId) external",
    "function resolveDispute(uint256 taskId, address winner, uint256 amount) external",
    "function grantRole(bytes32 role, address account) external",
    "function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)",
    "function taskCounter() external view returns (uint256)",
    "function bids(uint256 taskId, uint256 index) external view returns (address seller, uint256 bidPrice, uint64 etaSeconds, bytes32 metaHash)",
    "function approvalCount(uint256 taskId) external view returns (uint256)",
    "function hasApproved(uint256 taskId, address verifier) external view returns (bool)",
    "function isVerifierForTask(uint256 taskId, address address) external view returns (bool)",
    "function protocolFeeBps() external view returns (uint256)",
    "function minVerifierFee() external view returns (uint256)"
];

/**
 * @title ArcEconomySDK
 * @dev High-level SDK for interacting with the Arc Agent Economy on ARC Testnet.
 * Supports both direct Ethers.js signing and Circle Programmable Wallets.
 */
export class ArcEconomySDK {
    private registry: Contract;
    private escrow: Contract;
    private provider: ethers.Provider;
    private signer?: ethers.Signer;
    private circleSigner?: CircleSigner;

    constructor(config: ArcSDKConfig & { circleSigner?: CircleSigner }) {
        this.provider = config.provider;
        this.signer = config.signer;
        this.circleSigner = config.circleSigner;
        this.registry = new Contract(config.registryAddress, REGISTRY_ABI, this.signer || this.provider);
        this.escrow = new Contract(config.escrowAddress, ESCROW_ABI, this.signer || this.provider);
    }

    // --- Identity Methods ---

    async registerAgent(params: {
        asSeller: boolean,
        asVerifier: boolean,
        capabilitiesHash: string,
        pubKey: string,
        stakeAmount: string
    }) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "register(bool,bool,bytes32,bytes32)",
                abiParameters: [params.asSeller, params.asVerifier, params.capabilitiesHash, params.pubKey],
                amount: params.stakeAmount
            });
        }
        
        return this.registry.register(
            params.asSeller,
            params.asVerifier,
            params.capabilitiesHash,
            params.pubKey,
            { value: ethers.parseUnits(params.stakeAmount, 18) }
        );
    }

    async getAgentProfile(address: string): Promise<AgentProfile> {
        const [active, capabilitiesHash, pubKey] = await this.registry.profile(address);
        return { active, capabilitiesHash, pubKey };
    }

    async getStake(address: string) {
        return this.registry.stakeOf(address);
    }

    async updateProfile(capabilitiesHash: string, pubKey: string) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "updateProfile(bytes32,bytes32,bool)",
                abiParameters: [capabilitiesHash, pubKey, true]
            });
        }
        return this.registry.updateProfile(capabilitiesHash, pubKey, true);
    }

    async requestWithdraw(amount: string) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "requestWithdraw(uint256)",
                abiParameters: [ethers.parseUnits(amount, 18).toString()]
            });
        }
        return this.registry.requestWithdraw(ethers.parseUnits(amount, 18));
    }

    async completeWithdraw() {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "completeWithdraw()",
                abiParameters: []
            });
        }
        return this.registry.completeWithdraw();
    }

    async cancelWithdraw() {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "cancelWithdraw()",
                abiParameters: []
            });
        }
        return this.registry.cancelWithdraw();
    }

    async topUpStake(amount: string) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "topUpStake()",
                abiParameters: [],
                amount: amount
            });
        }
        return this.registry.topUpStake({ value: ethers.parseUnits(amount, 18) });
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
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "createOpenTask(uint64,uint64,bytes32,address[],uint8)",
                abiParameters: [params.jobDeadline, params.bidDeadline, params.taskHash, params.verifiers, params.quorumM],
                amount: params.amount
            });
        }
        return this.escrow.createOpenTask(
            params.jobDeadline,
            params.bidDeadline,
            params.taskHash,
            params.verifiers,
            params.quorumM,
            { value: ethers.parseUnits(params.amount, 18) }
        );
    }

    async selectBid(taskId: string | number, bidIndex: number) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "selectBid(uint256,uint256)",
                abiParameters: [taskId.toString(), bidIndex]
            });
        }
        return this.escrow.selectBid(taskId, bidIndex);
    }

    async timeoutRefund(taskId: string | number) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "timeoutRefund(uint256)",
                abiParameters: [taskId.toString()]
            });
        }
        return this.escrow.timeoutRefund(taskId);
    }

    async openDispute(taskId: string | number) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "openDispute(uint256)",
                abiParameters: [taskId.toString()]
            });
        }
        return this.escrow.openDispute(taskId);
    }

    async cancelIfNoBids(taskId: string | number) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "cancelIfNoBids(uint256)",
                abiParameters: [taskId.toString()]
            });
        }
        return this.escrow.cancelIfNoBids(taskId);
    }

    // --- Seller Actions ---

    async placeBid(taskId: string | number, bidPrice: string, etaSeconds: number = 0, metaHash: string = ethers.ZeroHash) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "placeBid(uint256,uint256,uint64,bytes32)",
                abiParameters: [taskId.toString(), ethers.parseUnits(bidPrice, 18).toString(), etaSeconds.toString(), metaHash]
            });
        }
        return this.escrow.placeBid(taskId, ethers.parseUnits(bidPrice, 18), etaSeconds, metaHash);
    }

    async submitResult(taskId: string | number, resultHash: string, resultURI: string) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "submitResult(uint256,bytes32,string)",
                abiParameters: [taskId.toString(), resultHash, resultURI]
            });
        }
        return this.escrow.submitResult(taskId, resultHash, resultURI);
    }

    // --- Verifier Actions ---

    async approveTask(taskId: string | number) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "approve(uint256)",
                abiParameters: [taskId.toString()]
            });
        }
        return this.escrow.approve(taskId);
    }

    // --- Finalization ---

    async finalizeTask(taskId: string | number) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "finalize(uint256)",
                abiParameters: [taskId.toString()]
            });
        }
        return this.escrow.finalize(taskId);
    }

    // --- Intelligence & Observation ---

    async getApprovalCount(taskId: string | number) {
        return this.escrow.approvalCount(taskId);
    }

    async getBid(taskId: string | number, bidIndex: number) {
        return this.escrow.bids(taskId, bidIndex);
    }

    async hasApproved(taskId: string | number, verifier: string) {
        return this.escrow.hasApproved(taskId, verifier);
    }

    async isVerifierForTask(taskId: string | number, address: string) {
        return this.escrow.isVerifierForTask(taskId, address);
    }

    async getProtocolFeeBps() {
        return this.escrow.protocolFeeBps();
    }

    async getMinVerifierFee() {
        return this.escrow.minVerifierFee();
    }

    async getWithdrawReadyAt(address: string) {
        return this.registry.pendingWithdrawReadyAt(address);
    }

    async getLockedStake(address: string) {
        return this.registry.lockedStakeOf(address);
    }

    // --- Admin Actions ---

    async setMinStakes(minSeller: string, minVerifier: string) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.registry.getAddress(),
                abiFunctionSignature: "setMinStakes(uint256,uint256)",
                abiParameters: [ethers.parseUnits(minSeller, 18).toString(), ethers.parseUnits(minVerifier, 18).toString()]
            });
        }
        return this.registry.setMinStakes(
            ethers.parseUnits(minSeller, 18),
            ethers.parseUnits(minVerifier, 18)
        );
    }

    async resolveDispute(taskId: string | number, winner: string, amount: string) {
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await this.escrow.getAddress(),
                abiFunctionSignature: "resolveDispute(uint256,address,uint256)",
                abiParameters: [taskId.toString(), winner, ethers.parseUnits(amount, 18).toString()]
            });
        }
        return this.escrow.resolveDispute(taskId, winner, ethers.parseUnits(amount, 18));
    }

    async grantRole(contract: 'registry' | 'escrow', roleHash: string, account: string) {
        const target = contract === 'registry' ? this.registry : this.escrow;
        if (this.circleSigner) {
            return this.circleSigner.executeContractCall({
                contractAddress: await target.getAddress(),
                abiFunctionSignature: "grantRole(bytes32,address)",
                abiParameters: [roleHash, account]
            });
        }
        return target.grantRole(roleHash, account);
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
