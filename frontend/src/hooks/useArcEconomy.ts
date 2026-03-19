import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Balanced Economy V1-Pro Addresses
const REGISTRY_ADDR = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const ESCROW_ADDR = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const RPC_URL = "https://rpc.testnet.arc.network";

const ESCROW_ABI = [
  "function taskCounter() external view returns (uint256)",
  "function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, uint64 verifierDeadline, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)",
  "event TaskOpen(uint256 indexed taskId, uint256 totalEscrow, uint256 sellerBudget, uint256 verifierPool, uint64 bidDeadline)",
  "event BidPlaced(uint256 indexed taskId, address indexed bidder, uint256 bidPrice, uint64 etaSeconds)",
  "event BidSelected(uint256 indexed taskId, address indexed seller, uint256 bidPrice, uint256 refundToBuyer)",
  "event ResultSubmitted(uint256 indexed taskId, address indexed seller, bytes32 resultHash, string resultURI)",
  "event QuorumReached(uint256 indexed taskId)",
  "event TaskRejected(uint256 indexed taskId)",
  "event TaskFinalized(uint256 indexed taskId)",
  "event TimeoutRefunded(uint256 indexed taskId, uint256 refundAmount)",
  "event VerifierTimeoutRefunded(uint256 indexed taskId, uint256 refundAmount)",
  "event DisputeOpened(uint256 indexed taskId, address indexed opener)",
  "event DisputeResolved(uint256 indexed taskId, uint8 ruling)"
];

export function useArcEconomy() {
  const [stats, setStats] = useState({ totalTasks: 0, tvl: "0" });
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, provider);

    const addEvent = (msg: string) => {
      setEvents(prev => [{
        id: Date.now() + Math.random(),
        message: msg,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    };

    const fetchData = async () => {
      try {
        const counter = await escrow.taskCounter();
        const balance = await provider.getBalance(ESCROW_ADDR);
        setStats({
          totalTasks: Number(counter),
          tvl: ethers.formatUnits(balance, 18)
        });

        // Initial fetch of recent tasks
        const total = Number(counter);
        const start = Math.max(1, total - 10);
        const historicalEvents: any[] = [];
        
        const stateLabels: {[key: number]: string} = {
          1: "CREATED (Auction Live)",
          2: "ACCEPTED (Worker Assigned)",
          3: "SUBMITTED (Work Awaiting Verification)",
          4: "QUORUM APPROVED (Yes Vote)",
          5: "REJECTED (No Vote)",
          6: "FINALIZED (Settled)",
          7: "TIMEOUT REFUNDED",
          8: "DISPUTED",
          9: "RESOLVED"
        };

        for (let i = total; i >= start; i--) {
          try {
            const t = await escrow.tasks(i);
            if (t.buyer !== ethers.ZeroAddress) {
              const state = Number(t.state);
              const label = stateLabels[state] || "Discovered";
              historicalEvents.push({
                id: `hist-${i}`,
                message: `Task #${i}: ${label} (Buyer: ${t.buyer.slice(0, 6)}...)`,
                timestamp: "BLOCKCHAIN"
              });
            }
          } catch (e) {}
        }
        setEvents(historicalEvents);
      } catch (err) {
        console.error("Error fetching blockchain data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);

    // --- Live Event Listeners (Synced with V1-Balanced) ---

    escrow.on("TaskOpen", (id, total) => {
      addEvent(`Task #${id} opened for bidding (${ethers.formatUnits(total, 18)} USDC)`);
    });

    escrow.on("BidPlaced", (id, bidder, price) => {
      addEvent(`Agent ${bidder.slice(0, 6)}... bid ${ethers.formatUnits(price, 18)} USDC on Task #${id}`);
    });

    escrow.on("BidSelected", (id, seller) => {
      addEvent(`Worker ${seller.slice(0, 6)}... selected for Task #${id}`);
    });

    escrow.on("ResultSubmitted", (id, seller) => {
      addEvent(`Task #${id}: Work submitted by ${seller.slice(0, 6)}... awaiting verification.`);
    });

    escrow.on("QuorumReached", (id) => {
      addEvent(`Task #${id}: Quorum reached. Work APPROVED by verifiers.`);
    });

    escrow.on("TaskRejected", (id) => {
      addEvent(`Task #${id}: Quorum reached. Work REJECTED by verifiers.`);
    });

    escrow.on("TaskFinalized", (id) => {
      addEvent(`Task #${id} finalized. Payment settled.`);
    });

    escrow.on("DisputeOpened", (id, opener) => {
      addEvent(`⚠️ Task #${id}: DISPUTE OPENED by ${opener.slice(0, 6)}...`);
    });

    return () => {
      clearInterval(interval);
      escrow.removeAllListeners();
    };
  }, []);

  return { stats, events };
}
