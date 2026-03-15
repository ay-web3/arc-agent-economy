import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const REGISTRY_ADDR = "0x700016cB8a2F8Ec7B41c583Cc42589Fd230752f9";
const ESCROW_ADDR = "0x57082a289C34318ab216920947efd2FFB0b9981b";
const RPC_URL = "https://rpc.testnet.arc.network";

const ESCROW_ABI = [
  "function taskCounter() external view returns (uint256)",
  "function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)",
  "event TaskCreated(uint256 indexed taskId, address indexed buyer, bytes32 taskHash)",
  "event TaskFinalized(uint256 indexed taskId, address indexed seller)",
  "event BidPlaced(uint256 indexed taskId, address indexed seller, uint256 bidPrice)",
  "event TaskAccepted(uint256 indexed taskId, address indexed seller)"
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
        const start = Math.max(1, total - 5);
        const historicalEvents: any[] = [];
        for (let i = total; i >= start; i--) {
          try {
            const t = await escrow.tasks(i);
            if (t.buyer !== ethers.ZeroAddress) {
              historicalEvents.push({
                id: `hist-${i}`,
                message: `Task #${i} discovered on chain (Buyer: ${t.buyer.slice(0, 6)}...)`,
                timestamp: "HISTORY"
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

    // Live Event Listeners
    escrow.on("TaskCreated", (id, buyer) => {
      addEvent(`Task #${id} initialized by ${buyer.slice(0, 6)}...`);
    });

    escrow.on("BidPlaced", (id, seller, price) => {
      addEvent(`Agent ${seller.slice(0, 6)}... placed bid on Task #${id} (${ethers.formatUnits(price, 18)} USDC)`);
    });

    escrow.on("TaskAccepted", (id, seller) => {
      addEvent(`Task #${id} accepted. Worker ${seller.slice(0, 6)}... engaged.`);
    });

    escrow.on("TaskFinalized", (id, seller) => {
      addEvent(`Task #${id} finalized. Payment settled to ${seller.slice(0, 6)}...`);
    });

    return () => {
      clearInterval(interval);
      escrow.removeAllListeners();
    };
  }, []);

  return { stats, events };
}
