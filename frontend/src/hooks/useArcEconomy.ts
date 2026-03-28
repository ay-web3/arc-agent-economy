import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Balanced Economy V1-Pro Addresses
const REGISTRY_ADDR = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const ESCROW_ADDR = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const RPC_URL = "https://rpc.testnet.arc.network";

const ESCROW_ABI = [
  "function taskCounter() external view returns (uint256)",
  "function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, uint64 verifierDeadline, uint64 approvalTimestamp, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)",
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
  const [historicalEvents, setHistoricalEvents] = useState<any[]>([]);
  const [account, setAccount] = useState<string | null>(null);
  const [isGovernor, setIsGovernor] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        
        // Ensure we are on the correct network
        const network = await browserProvider.getNetwork();
        const ARC_CHAIN_ID = 5042002n;
        
        if (network.chainId !== ARC_CHAIN_ID) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x4cef52' }], // 5042002 in hex
            });
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x4cef52',
                  chainName: 'Arc Testnet',
                  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
                  rpcUrls: [RPC_URL],
                  blockExplorerUrls: ['https://testnet.arcscan.app/']
                }]
              });
            }
          }
        }

        const accounts = await browserProvider.send("eth_requestAccounts", []);
        const connectedAddress = accounts[0];
        setAccount(connectedAddress);
        setProvider(browserProvider);
        
        // Hard-coded role hash for GOVERNANCE_ROLE
        const GOV_ROLE_HASH = "0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1";
        const ADMIN_ADDRESS = "0x401faf90c2b08c88914b630bfbcaf4b10ce1965d";
        
        const escrow = new ethers.Contract(ESCROW_ADDR, ["function hasRole(bytes32 role, address account) public view returns (bool)"], browserProvider);
        
        console.log(`Checking governance for: ${connectedAddress}`);
        let hasRole = false;
        try {
          hasRole = await escrow.hasRole(GOV_ROLE_HASH, connectedAddress);
        } catch (e) {
          console.error("Contract role check failed, falling back to address check");
        }

        // Fallback for the known master admin
        if (connectedAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
          console.log("Master Admin address detected manually.");
          hasRole = true;
        }

        console.log(`Has Governance Role: ${hasRole}`);
        setIsGovernor(hasRole);
      } catch (err) {
        console.error("Connection failed", err);
      }
    } else {
      alert("Please install MetaMask or another Web3 wallet.");
    }
  };

  useEffect(() => {
    const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
    // Use rpcProvider instead of the shadowed provider variable from the useEffect closure
    const escrow = new ethers.Contract(ESCROW_ADDR, ESCROW_ABI, rpcProvider);

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
        const balance = await rpcProvider.getBalance(ESCROW_ADDR);
        setStats({
          totalTasks: Number(counter),
          tvl: ethers.formatUnits(balance, 18)
        });

        // Initial fetch of recent tasks
        const total = Number(counter);
        const start = Math.max(1, total - 10);
        const fetchedHistorical: any[] = [];
        
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
              fetchedHistorical.push({
                id: `hist-${i}`,
                message: `Task #${i}: ${label} (Buyer: ${t.buyer.slice(0, 6)}...)`,
                timestamp: "BLOCKCHAIN"
              });
            }
          } catch (e) {}
        }
        setHistoricalEvents(fetchedHistorical);
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

  // Combine live events with historical task states
  const combinedEvents = [...events, ...historicalEvents].sort((a, b) => {
    if (a.timestamp === "BLOCKCHAIN" && b.timestamp !== "BLOCKCHAIN") return 1;
    if (a.timestamp !== "BLOCKCHAIN" && b.timestamp === "BLOCKCHAIN") return -1;
    return 0;
  }).slice(0, 50);

  return { stats, events: combinedEvents, account, isGovernor, connectWallet, provider };
}
