import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum: any;
  }
}

// Balanced Economy V1-Pro Addresses
const REGISTRY_ADDR = "0x9C2e68251E91dD9724feD8E6D270bC7542273d0C";
const ESCROW_ADDR   = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
const IDENTITY_PROTOCOL_ADDR   = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; // ERC-8004 official
const REPUTATION_PROTOCOL_ADDR = "0x8004B663056A597Dffe9eCcC1965A193B7388713"; // ERC-8004 official
const RPC_URL = "https://rpc.testnet.arc.network";

export function useArcEconomy() {
  const [stats, setStats] = useState({ totalTasks: 0, tvl: "0", totalVolume: "0", revenue: "0", costs: "0", globalSupplyTasks: 0, protocolRevenue: "0" });
  const [events, setEvents] = useState<any[]>([]);
  const [historicalEvents, setHistoricalEvents] = useState<any[]>([]);


  const inspectAgent = async (target: string) => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
      
      // 1. STATE-FIRST DISCOVERY (No block limits)
      const localRegistry = new ethers.Contract(REGISTRY_ADDR, [
        "function profile(address) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)",
        "function stakeOf(address) external view returns (uint256)"
      ], rpcProvider);
      
      const [localProf, totalStakeWei] = await Promise.all([
        localRegistry.profile(target),
        localRegistry.stakeOf(target)
      ]);
      const totalStake = ethers.formatUnits(totalStakeWei, 18);
      const hasStake = parseFloat(totalStake) > 0;

      // 2. Protocol Identity Scan (Capped at 10,000 to prevent RPC 500)
      const identityContract = new ethers.Contract(IDENTITY_PROTOCOL_ADDR, [
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        "function tokenURI(uint256 tokenId) external view returns (string)"
      ], rpcProvider);

      let agentId = null;
      let tokenURI = null;
      
      try {
        const filter = identityContract.filters.Transfer(null, target);
        const logs = await identityContract.queryFilter(filter, -10000); 
        if (logs.length > 0) {
          // @ts-ignore
          agentId = logs[logs.length - 1].args.tokenId;
          tokenURI = await identityContract.tokenURI(agentId);
        }
      } catch (e) {
        console.warn("NFT Log scan failed (likely out of 10k range), falling back to state discovery.");
      }

      // 3. Official Reputation Scan (Capped at 10,000)
      let protocolRep = 0;
      if (agentId) {
        try {
          const reputationContract = new ethers.Contract(REPUTATION_PROTOCOL_ADDR, [
            "event FeedbackGiven(uint256 indexed agentId, int128 score, uint8 feedbackType, string tag)"
          ], rpcProvider);
          const repFilter = reputationContract.filters.FeedbackGiven(agentId);
          const repLogs = await reputationContract.queryFilter(repFilter, -10000);
          protocolRep = repLogs.length; 
        } catch (e) {
            console.warn("Reputation scan failed.");
        }
      }

      // FINAL VISIBILITY CHECK
      if (!agentId && !localProf.active && !hasStake) return null;

      return {
        agentId: agentId ? agentId.toString() : "LEGACY_MDL",
        tokenURI: tokenURI,
        stake: totalStake,
        reputation: protocolRep || (localProf.active ? 1 : (hasStake ? 1 : 0)),
        isRegistered: agentId ? true : localProf.active || hasStake,
        isProtocolStandard: !!agentId
      };
    } catch (e) {
      console.error("Agent inspection failed", e);
      return null;
    }
  };

  useEffect(() => {
    const addEvent = (msg: string) => {
      setEvents(prev => [{
        id: Date.now() + Math.random(),
        message: msg,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    };

    const fetchData = async () => {
      try {
        const response = await fetch('https://arc-agent-economy.onrender.com/api/stats');
        if (response.ok) {
           const data = await response.json();
           setStats(data);
        } else {
           console.warn("Failed to fetch Sovereign Hub stats.");
        }
      } catch (err) {
        console.error("Error fetching Hub API data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000); // Increased frequency to 4s for 'live' feel

    // --- Live Event Listeners (Synced with V1-Balanced) ---

    const handleTaskOpen = (id: any, total: any) => {
      addEvent(`[NEW] Task #${id} opened for bidding (${ethers.formatUnits(total, 18)} USDC)`);
      fetchData(); // Trigger immediate refresh
    };

    const handleBidPlaced = (id: any, bidder: any, price: any) => {
      addEvent(`Agent ${bidder.slice(0, 6)}... bid ${ethers.formatUnits(price, 18)} USDC on Task #${id}`);
      fetchData();
    };

    const handleBidSelected = (id: any, seller: any) => {
      addEvent(`Worker ${seller.slice(0, 6)}... selected for Task #${id}`);
      fetchData();
    };

    const handleResultSubmitted = (id: any, seller: any) => {
      addEvent(`Task #${id}: Work submitted by ${seller.slice(0, 6)}... awaiting verification.`);
      fetchData();
    };

    const handleQuorumReached = (id: any) => {
      addEvent(`Task #${id}: Quorum reached. Work APPROVED by verifiers.`);
      fetchData();
    };

    const handleTaskRejected = (id: any) => {
      addEvent(`Task #${id}: Quorum reached. Work REJECTED by verifiers.`);
      fetchData();
    };

    const handleTaskFinalized = (id: any) => {
      addEvent(`Task #${id} finalized. Payment settled.`);
      fetchData();
    };

    const handleDisputeOpened = (id: any, opener: any) => {
      addEvent(`⚠️ Task #${id}: DISPUTE OPENED by ${opener.slice(0, 6)}...`);
      fetchData();
    };

    return () => {
      clearInterval(interval);
    };
  }, []); // Run once on mount

  // Combine live events with historical task states
  const combinedEvents = [...events, ...historicalEvents].sort((a, b) => {
    if (a.timestamp === "BLOCKCHAIN" && b.timestamp !== "BLOCKCHAIN") return 1;
    if (a.timestamp !== "BLOCKCHAIN" && b.timestamp === "BLOCKCHAIN") return -1;
    return 0;
  }).slice(0, 50);

  const [nanoHistory, setNanoHistory] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [a2aServices, setA2aServices] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // @ts-ignore
  const HUB_URL = import.meta.env?.VITE_HUB_URL || (isLocal ? "http://localhost:8080" : "https://arc-agent-economy.onrender.com");

  const fetchNanoHistory = async () => {
    try {
      const resp = await fetch(`${HUB_URL}/api/nano-history`);
      const data = await resp.json();
      if (data.success) {
        setNanoHistory(data.history);
      }
    } catch (e) {
        console.error("Failed to fetch nano history", e);
    }
  };

  const fetchServices = async () => {
    try {
      const resp = await fetch(`${HUB_URL}/services/catalog`);
      const data = await resp.json();
      if (data.success) setServices(data.services);
    } catch (e) {
        console.error("Failed to fetch services catalog", e);
    }
  };

  const fetchA2AServices = async () => {
    try {
      const resp = await fetch(`${HUB_URL}/api/registry/services`);
      const data = await resp.json();
      setA2aServices(data);
    } catch (e) {
        console.error("Failed to fetch A2A registry", e);
    }
  };

  const fetchTasks = async () => {
    try {
      const resp = await fetch(`${HUB_URL}/api/tasks`);
      const data = await resp.json();
      setTasks(data.tasks || data);
    } catch (e) {
        console.error("Failed to fetch tasks", e);
    }
  };

  useEffect(() => {
    fetchNanoHistory();
    fetchServices();
    fetchA2AServices();
    fetchTasks();
    const inv = setInterval(() => {
        fetchNanoHistory();
        fetchServices();
        fetchA2AServices();
        fetchTasks();
    }, 4000);
    return () => clearInterval(inv);
  }, []);

  return { stats, events: combinedEvents, inspectAgent, nanoHistory, services, a2aServices, tasks };
}
