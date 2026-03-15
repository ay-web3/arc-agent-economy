import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const REGISTRY_ADDR = "0x700016cB8a2F8Ec7B41c583Cc42589Fd230752f9";
const ESCROW_ADDR = "0x57082a289C34318ab216920947efd2FFB0b9981b";
const RPC_URL = "https://rpc.testnet.arc.network";

const ESCROW_ABI = [
  "function taskCounter() external view returns (uint256)",
  "function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)",
  "event TaskCreated(uint256 indexed taskId, address indexed buyer, bytes32 taskHash)",
  "event TaskFinalized(uint256 indexed taskId, address indexed seller)"
];

export function useArcEconomy() {
  const [stats, setStats] = useState({ totalTasks: 0, tvl: "0" });
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, provider);

    const fetchData = async () => {
      try {
        const counter = await escrow.taskCounter();
        const balance = await provider.getBalance(ESCROW_ADDR);
        setStats({
          totalTasks: Number(counter),
          tvl: ethers.formatUnits(balance, 18)
        });

        // Initial fetch of recent tasks to populate pulse
        const total = Number(counter);
        const start = Math.max(1, total - 5);
        const historicalEvents: any[] = [];
        for (let i = total; i >= start; i--) {
          try {
            const t = await escrow.tasks(i);
            historicalEvents.push({
              id: `hist-${i}`,
              type: 'CREATED',
              message: `Task #${i} discovered on chain (Buyer: ${t.buyer.slice(0, 6)}...)`,
              timestamp: "HISTORY"
            });
          } catch (e) {}
        }
        setEvents(historicalEvents);
      } catch (err) {
        console.error("Error fetching blockchain data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);

    // Live Event Listeners
    escrow.on("TaskCreated", (id, buyer, hash) => {
      setEvents(prev => [{
        id: Date.now(),
        type: 'CREATED',
        message: `Task #${id} initialized by ${buyer.slice(0, 6)}...`,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    });

    return () => {
      clearInterval(interval);
      escrow.removeAllListeners();
    };
  }, []);

  return { stats, events };
}
