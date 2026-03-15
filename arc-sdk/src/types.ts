import { ethers } from "ethers";

export interface ArcSDKConfig {
    provider: ethers.Provider;
    signer?: ethers.Signer;
    registryAddress: string;
    escrowAddress: string;
}

export enum TaskState {
    NONE = 0,
    CREATED = 1,
    ACCEPTED = 2,
    SUBMITTED = 3,
    QUORUM_APPROVED = 4,
    FINALIZED = 5,
    TIMEOUT_REFUNDED = 6,
    DISPUTED = 7,
    RESOLVED = 8
}

export interface AgentProfile {
    active: boolean;
    capabilitiesHash: string;
    pubKey: string;
}

export interface Task {
    buyer: string;
    seller: string;
    price: bigint;
    verifierPool: bigint;
    sellerBudget: bigint;
    deadline: bigint;
    bidDeadline: bigint;
    taskHash: string;
    resultHash: string;
    resultURI: string;
    state: TaskState;
    quorumM: number;
    quorumN: number;
}
