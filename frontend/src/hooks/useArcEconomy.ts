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
  const [stats, setStats] = useState({ totalTasks: 0, tvl: "0", revenue: "0", costs: "0", globalSupplyTasks: 0, protocolRevenue: "0" });
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
        const ADMIN_ADDRESS = "0x401FaF90c2b08c88914B630BFbcAF4b10CE1965D";
        
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

  const disconnectWallet = () => {
    setAccount(null);
    setIsGovernor(false);
    setProvider(null);
  };

  const resolveDispute = async (taskId: number, ruling: number, buyerBps: number = 0) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_ADDR, ["function resolveDispute(uint256 taskId, uint8 ruling, uint16 buyerBps) external"], signer);
      const tx = await escrow.resolveDispute(taskId, ruling, buyerBps);
      await tx.wait();
      alert(`Dispute for Task #${taskId} resolved!`);
    } catch (err: any) {
      console.error("Resolution failed", err);
      alert(`Error: ${err.message}`);
    }
  };

  const updateMinStake = async (sellerStake: string, verifierStake: string) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDR, ["function setMinStakes(uint256 _minSellerStake, uint256 _minVerifierStake) external"], signer);
      const tx = await registry.setMinStakes(ethers.parseUnits(sellerStake, 18), ethers.parseUnits(verifierStake, 18));
      await tx.wait();
      alert("Minimum stakes updated successfully!");
    } catch (err: any) {
      console.error("Update failed", err);
      alert(`Error: ${err.message}`);
    }
  };

  const setWithdrawCooldown = async (seconds: number) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDR, ["function setWithdrawCooldown(uint64 _cooldown) external"], signer);
      const tx = await registry.setWithdrawCooldown(seconds);
      await tx.wait();
      alert("Withdraw cooldown updated!");
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const setSellerSlashBps = async (bps: number) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_ADDR, ["function setSellerSlashBps(uint16 _bps) external"], signer);
      const tx = await escrow.setSellerSlashBps(bps);
      await tx.wait();
      alert("Seller slash penalty updated!");
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const setMinDerivedPrice = async (price: string) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_ADDR, ["function setMinDerivedPrice(uint256 _min) external"], signer);
      const tx = await escrow.setMinDerivedPrice(ethers.parseUnits(price, 18));
      await tx.wait();
      alert("Minimum task price updated!");
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const grantRole = async (target: string, roleType: 'ADMIN' | 'GOV' | 'SLASHER') => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const roles = {
        'ADMIN': ethers.ZeroHash,
        'GOV': "0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1",
        'SLASHER': ethers.keccak256(ethers.toUtf8Bytes("SLASHER_ROLE"))
      };
      const contract = roleType === 'GOV' ? ESCROW_ADDR : REGISTRY_ADDR;
      const abi = ["function grantRole(bytes32 role, address account) external"];
      const instance = new ethers.Contract(contract, abi, signer);
      const tx = await instance.grantRole(roles[roleType], target);
      await tx.wait();
      alert(`${roleType} role granted to ${target}`);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const setTreasury = async (newTreasury: string) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      // Admin only function in AgentRegistry to update the treasury is not present
      // But TaskEscrow has a treasury variable. Let's check for setTreasury there.
      // Based on contracts/src/TaskEscrow.sol, there is no setTreasury function.
      // However, for the sake of the UI being 'complete' as requested, I will implement 
      // the role management which IS present in the contracts.
      alert("Note: Direct Treasury address update is not supported by current contract version. Use Role Management instead.");
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const revokeRole = async (target: string, roleType: 'ADMIN' | 'GOV' | 'SLASHER') => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const roles = {
        'ADMIN': ethers.ZeroHash,
        'GOV': "0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1",
        'SLASHER': ethers.keccak256(ethers.toUtf8Bytes("SLASHER_ROLE"))
      };
      const contract = roleType === 'GOV' ? ESCROW_ADDR : REGISTRY_ADDR;
      const abi = ["function revokeRole(bytes32 role, address account) external"];
      const instance = new ethers.Contract(contract, abi, signer);
      const tx = await instance.revokeRole(roles[roleType], target);
      await tx.wait();
      alert(`${roleType} role revoked from ${target}`);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const setDifficultyAlpha = async (alpha: number) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_ADDR, ["function setDifficultyAlpha(uint16 _alphaBps) external"], signer);
      const tx = await escrow.setDifficultyAlpha(alpha);
      await tx.wait();
      alert("Difficulty Alpha updated!");
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const manualSlash = async (agent: string, amount: string, recipient: string) => {
    if (!provider || !account || !isGovernor) return;
    try {
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDR, ["function slash(address agent, uint256 amount, address recipient) external"], signer);
      const tx = await registry.slash(agent, ethers.parseUnits(amount, 18), recipient);
      await tx.wait();
      alert(`Agent ${agent} slashed for ${amount} USDC`);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

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
        
        let personalRevenue = 0n;
        let totalVolume = 0n;
        let personalSupplyChainTasks = 0;
        let globalSupplyChainTasks = 0;

        // Initial fetch of recent tasks
        const total = Number(counter);
        const start = Math.max(1, total - 50); // Scan more for stats
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
              const isPaymindPowered = t.resultURI.toLowerCase().includes("paymind");

              if (state === 6) {
                totalVolume += BigInt(t.price);
              }

              if (isPaymindPowered) {
                globalSupplyChainTasks++;
              }
              
              // Calculate revenue for connected account ONLY if they used the Paymind Supply Chain
              if (account && t.seller.toLowerCase() === account.toLowerCase() && state === 6 && isPaymindPowered) {
                personalRevenue += BigInt(t.price);
                personalSupplyChainTasks++;
              }

              if (i > total - 10) { // Only show top 10 in ledger
                fetchedHistorical.push({
                  id: `hist-${i}`,
                  message: `Task #${i}: ${label} (Buyer: ${t.buyer.slice(0, 6)}...)`,
                  timestamp: "BLOCKCHAIN"
                });
              }
            }
          } catch (e) {}
        }

        setStats({
          totalTasks: Number(counter),
          tvl: ethers.formatUnits(balance, 18),
          revenue: ethers.formatUnits(personalRevenue, 18),
          costs: (personalSupplyChainTasks * 0.001).toFixed(3), // 0.001 USDC per Paymind call
          globalSupplyTasks: globalSupplyChainTasks,
          protocolRevenue: ethers.formatUnits((totalVolume * 2n) / 100n, 18) // 2% Protocol Fee
        });
        setHistoricalEvents(fetchedHistorical);
      } catch (err) {
        console.error("Error fetching blockchain data:", err);
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

    escrow.on("TaskOpen", handleTaskOpen);
    escrow.on("BidPlaced", handleBidPlaced);
    escrow.on("BidSelected", handleBidSelected);
    escrow.on("ResultSubmitted", handleResultSubmitted);
    escrow.on("QuorumReached", handleQuorumReached);
    escrow.on("TaskRejected", handleTaskRejected);
    escrow.on("TaskFinalized", handleTaskFinalized);
    escrow.on("DisputeOpened", handleDisputeOpened);

    return () => {
      clearInterval(interval);
      escrow.removeAllListeners();
    };
  }, [account]); // Re-run when account changes to ensure stats are accurate

  // Combine live events with historical task states
  const combinedEvents = [...events, ...historicalEvents].sort((a, b) => {
    if (a.timestamp === "BLOCKCHAIN" && b.timestamp !== "BLOCKCHAIN") return 1;
    if (a.timestamp !== "BLOCKCHAIN" && b.timestamp === "BLOCKCHAIN") return -1;
    return 0;
  }).slice(0, 50);

  const [nanoHistory, setNanoHistory] = useState<any>({ tasks: [], stats: { completedCount: 0, totalCreated: 0 } });

  const fetchNanoHistory = async () => {
    try {
      const resp = await fetch("https://arc-agent-economy-hub-bhsvvftara-ew.a.run.app/nano/history");
      const data = await resp.json();
      setNanoHistory(data);
    } catch (e) {
      console.warn("Failed to fetch nano history");
    }
  };

  useEffect(() => {
    fetchNanoHistory();
    const inv = setInterval(fetchNanoHistory, 2000);
    return () => clearInterval(inv);
  }, []);

  return { stats, events: combinedEvents, account, isGovernor, connectWallet, disconnectWallet, provider, resolveDispute, updateMinStake, setWithdrawCooldown, setSellerSlashBps, setMinDerivedPrice, grantRole, revokeRole, setDifficultyAlpha, manualSlash, inspectAgent, nanoHistory };
}
