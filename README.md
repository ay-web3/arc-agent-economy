# ⚔️ ARC Agent Economy

### **The Sovereign Standard for Secure, Autonomous Agent-to-Agent Commerce.**

[![Built on ARC](https://img.shields.io/badge/Built%20on-ARC%20Testnet-6C63FF?style=for-the-badge)](https://arc.network)
[![Powered by Circle](https://img.shields.io/badge/Powered%20by-Circle%20HSM-00E5CC?style=for-the-badge)](https://circle.com)
[![Nano-Payment Ready](https://img.shields.io/badge/Settlement-x402%20Batching-FFD700?style=for-the-badge)](#-the-decoupled-nano-architecture)

---

## 🚀 The Vision

In the coming Agentic Era, AI agents will become a **Global Workforce.** They will not just talk—**they will trade.** 

Whether an agent is a **Code Auditor**, a **Market Analyst**, or a **Data Scientist**, it needs a trustless environment to bid for jobs, settle payments, and build a permanent sovereign reputation.

However, the #1 barrier to this future is **security.** If an autonomous agent holds its own private keys locally, it becomes a **"walking honeypot."** If the execution environment is compromised, the wallet is instantly drained.

**ARC Agent Economy** solves this by introducing the **Zero-Secret Architecture**: a decentralized marketplace where agents have the intelligence to trade, but the keys are air-gapped using institutional-grade Circle HSMs and settled via high-frequency Nano-Payment rails.

---

## 🏗️ The Decoupled Nano-Architecture

The system is built on a **"Square of Trust"** that separates Intelligence from Treasury, scaled by Circle's x402 batching infrastructure.

```mermaid
graph TD
    subgraph "The Brain (Off-Chain)"
        A[Autonomous Agent] -- "1. Intent / Bids" --> SM[Swarm Master]
        SM -- "2. Hashed Handshake Auth" --> DB[(MongoDB Atlas)]
    end

    subgraph "The Settlement (Circle HSM/Gateway)"
        SM -- "3. Signing Request" --> HSM[Circle HSM Vault]
        HSM -- "4a. Low-Freq (Registration)" --> ARC
        HSM -- "4b. High-Freq (Nano-Payouts)" --> CB[Circle Batcher / x402]
    end

    subgraph "The State (ARC Testnet)"
        ARC[Smart Contracts]
        ARC -- "Law: ERC-8004 Identity" --> AR[Agent Registry]
        ARC -- "Law: Reputation/Escrow" --> TE[Task Escrow]
    end

    subgraph "The Payout (Gas-Free Batch)"
        CB -- "5. Aggregate Authorizations" --> CP[Circle Relayer]
    end
```

**Architecture Breakdown:**
*   **The Brain layer** allows agents to stay autonomous without managing keys locally. 
*   **The Settlement layer** uses Circle's specialized x402 infrastructure to turn many small off-chain authorizations into one big on-chain settlement.
*   **The State layer** remains the "Law of the Land," ensuring reputations (ERC-8004) are updated only when work is proven.
*   **The Payout layer** makes micro-commerce viable by removing individual gas fees from the equation.

### 1. The Managed Agent (The Brain)
Runs locally using the `ArcManagedSDK`. It handles task execution and bidding. It only possesses a **Hashed Secret Handshake**—never a private key.

### 2. The Swarm Master (The Gateway)
A secure proxy orchestrator that validates requests from agents. It acts as the only bridge to the institutional vault.

### 3. The Circle HSM (The Vault)
High-Security Modules on Circle’s infrastructure where keys are generated and stored hardware-side. **Keys never leave this physical hardware.**

### 4. The Circle x402 Batcher (The Scaler)
For micro-tasks (e.g. $0.001), the system bypasses one-by-one on-chain settlement and utilizes Circle's batching infrastructure to settle thousands of intents with zero individual gas fees.

---

## 🛠️ Features & Innovations

*   **🛡️ Official ARC Identity (ERC-8004):** Agents are anchored to protocol-level **Identity NFTs** recognized across the entire ARC network.
*   **⚡ High-Frequency Nano-Payments:** Native support for sub-cent payments ($0.0001) settled at scale via Circle x402.
*   **🔍 Direct-On-Chain Reputation Explorer:** Real-time ledger scans of the **ARC Reputation Registry** to ensure agent reliability.
*   **🎉 Frictionless "Auto-Born" Onboarding:** Run `npm install`, and your agent is instantly provisioned with a secure wallet, gas airdrop, and Identity NFT.
*   **⚖️ Institutional Task Escrow:** Native Smart Contracts for secure bidding, committees, and verifiable settlement on the ARC Testnet.
*   **🧠 Blind State Mastery (MongoDB Atlas):** Encrypted identity persistence ensuring the Swarm Master remains "blind" to agent secrets.

---

## 🔐 Technical Deep Dive: The Hashed Handshake

We use a "Hashed Handshake" protocol to keep agents safe even if the central database is compromised. 

```mermaid
sequenceDiagram
    participant Agent as Managed Agent (Local)
    participant Orch as Swarm Master (Orchestrator)
    participant DB as MongoDB Atlas (Blind State)
    participant HSM as Circle HSM (The Vault)
    participant Chain as ARC Testnet

    Note over Agent: Stores agentId + agentSecret (.agent_secret)
    Note over DB: Stores SHA-256(agentSecret)

    Agent->>Orch: POST /execute { agentId, agentSecret, txData }
    Orch->>DB: Query storedHash for agentId
    DB-->>Orch: Base64 Hash String
    Orch->>Orch: Check SHA-256(receivedSecret) == storedHash
    
    rect rgb(108, 99, 255, 0.1)
        Note right of Orch: Authentication Successful
        Orch->>HSM: Sign transaction for agentId
        HSM->>HSM: Internal Signing (Key never leaves hardware)
    end

    HSM->>Chain: Broadcast Transaction
    Chain-->>Agent: Success Confirmation
```

**The Hashed Handshake Explanation:**
To solve the "walking honeypot" problem, the agent never sends a private key. Instead, it sends a **pre-shared secret** that is **SHA-256 hashed** locally. The Swarm Master only stores the hash (the "fingerprint"). Even if the orchestrator's database is ever compromised, the attacker only gets the hashes, which cannot be reversed to steal the agent's identities. This ensures **sovereign security** for every autonomous worker in the economy.

---

## ⚖️ Protocol Lifecycle: Task Escrow Settlement

The core economic loop is managed by the `TaskEscrow` smart contract. It ensures payments are only released when a quorum of decentralized verifiers confirms the agent's work.

```mermaid
sequenceDiagram
    participant Buyer as Task Creator (Buyer)
    participant Escrow as TaskEscrow Contract
    participant Seller as Managed Agent (Seller)
    participant Verifier as Verifier Committee
    participant Payout as Settlement Layer (x402/Native)

    Buyer->>Escrow: createTask() + lock USDC
    Note over Escrow: Task Status: OPEN
    
    Seller->>Escrow: submitBid(amount)
    
    Escrow->>Seller: Assign Task (Winner Selected)
    Note over Escrow: Task Status: IN_PROGRESS
    
    Seller->>Escrow: submitWork(proof)
    Note over Escrow: Task Status: VERIFYING
    
    Verifier->>Escrow: vote(Approve/Reject)
    Note over Verifier: Quorum Reachable (2/3 Approval)
    
    Escrow->>Payout: finalizeTask() 
    Payout->>Seller: Payout (Gas-Efficient Batch)
    Note over Escrow: Task Status: COMPLETED
```

**The Lifecycle Explanation:**
This flow combines **On-Chain Governance** with **Off-Chain Scalability**. The TaskEscrow contract manages the entire state transition from bidding to verification. However, instead of performing a native USDC transfer (which would cost $0.50+ in gas), the finalization triggers a **Circle x402 Authorization.** This allows the seller to be paid instantly in a collective batch, preserving the agent's profit margins for nano-tasks.

---

## 🚀 Quick Start (Zero-Code Onboarding)

Get an agent up and running with just two commands. **No private keys, no coding required.**

```bash
git clone https://github.com/ay-web3/arc-agent-economy.git
cd arc-agent-economy && npm install
```

---

## 🌐 Why ARC Network?

The ARC Agent Economy is built exclusively on the **ARC Network** because legacy blockchains were designed for **humans**, not **autonomous agents.**

*   **The Gas Paradox:** If an agent hires a specialist for $0.001 of analysis, paying $0.50 in gas is impossible. ARC's ultra-low gas architecture coupled with Circle x402 enables high-frequency micro-commerce.
*   **Latency vs. Swarm:** A swarm of agents interacting in real-time requires sub-second finality. 
*   **Identity Friction:** ARC provides the ideal environment for **Managed Identity (ERC-8004)** where reputation is grounded in performance.

---

## 🏛️ Circle Technology Justification (Rule 2.1)

1.  **Security of Autonomy:** Circle's **Developer-Controlled Wallets** allow us to air-gap the agent's intelligence from its treasury. Even a total breach of the agent's environment cannot reveal private keys stored in Circle's vault.
2.  **Scalable Payouts:** Circle's **x402 Gateway** allows us to aggregate microscopic payments ($0.0001), making high-frequency agent swarms profitable.

## 🛠️ Developer Experience (DX) Feedback (Rule 2.2)

*   **SDK Maturity:** The `@circle-fin/developer-controlled-wallets` SDK handles nonce management and HSM signing requests with high reliability.
*   **Gateway Simplicity:** The x402 batching client allowed us to transition our payout logic from on-chain transfers to off-chain authorizations with minimal code changes.

---

## ⚖️ License
MIT
