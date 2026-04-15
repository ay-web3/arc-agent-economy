// ─────────────────────────────────────────────
//  ARC Agent Economy — Shared Config
//  Direct on-chain access. No orchestrator needed.
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Network ──────────────────────────────────
export const RPC_URL   = 'https://rpc.testnet.arc.network';
export const CHAIN_ID  = 1116; // ARC Testnet

// ── Deployed Contracts ───────────────────────
export const REGISTRY_ADDRESS = '0x8b8c8c03eee05334412c73b298705711828e9ca1';
export const ESCROW_ADDRESS   = '0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c';

// ── Economics ────────────────────────────────
export const MIN_SELLER_STAKE   = ethers.parseEther('50.0');
export const MIN_VERIFIER_STAKE = ethers.parseEther('30.0');

// ── AgentRegistry ABI (key functions only) ───
export const REGISTRY_ABI = [
  'function register(bool asSeller, bool asVerifier, bytes32 capabilitiesHash, bytes32 pubKey) external payable',
  'function topUpStake() external payable',
  'function requestWithdraw(uint256 amount) external',
  'function cancelWithdraw() external',
  'function completeWithdraw() external',
  'function updateProfile(bytes32 capabilitiesHash, bytes32 pubKey, bool active) external',
  'function setRoles(bool wantSeller, bool wantVerifier) external',
  'function isSeller(address agent) external view returns (bool)',
  'function isVerifier(address agent) external view returns (bool)',
  'function isActive(address agent) external view returns (bool)',
  'function stakeOf(address agent) external view returns (uint256)',
  'function lockedStakeOf(address agent) external view returns (uint256)',
  'function availableStake(address agent) external view returns (uint256)',
  'function pendingWithdrawAmount(address agent) external view returns (uint256)',
  'function pendingWithdrawReadyAt(address agent) external view returns (uint64)',
  'function minSellerStake() external view returns (uint256)',
  'function minVerifierStake() external view returns (uint256)',
  'function withdrawCooldown() external view returns (uint64)',
  'function profile(address agent) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)',
  'event AgentRegistered(address indexed agent, bytes32 capabilitiesHash, bytes32 pubKey)',
  'event StakeToppedUp(address indexed agent, uint256 amount, uint256 newStake)',
  'event StakeSlashed(address indexed agent, uint256 amount, address indexed recipient)',
];

// ── TaskEscrow ABI (key functions only) ──────
export const ESCROW_ABI = [
  'function createOpenTask(uint64 jobDeadline, uint64 bidDeadline, uint64 verifierDeadline, bytes32 taskHash, address[] calldata verifiers, uint8 quorumM) external payable returns (uint256 taskId)',
  'function placeBid(uint256 taskId, uint256 bidPrice, uint64 etaSeconds, bytes32 metaHash) external',
  'function selectBid(uint256 taskId, uint256 bidIndex) external',
  'function finalizeAuction(uint256 taskId) external',
  'function cancelIfNoBids(uint256 taskId) external',
  'function submitResult(uint256 taskId, bytes32 resultHash, string calldata resultURI) external',
  'function approve(uint256 taskId) external',
  'function reject(uint256 taskId) external',
  'function finalize(uint256 taskId) external',
  'function openDispute(uint256 taskId) external',
  'function timeoutRefund(uint256 taskId) external',
  'function tasks(uint256 taskId) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, uint64 verifierDeadline, uint64 approvalTimestamp, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)',
  'function bids(uint256 taskId, uint256 index) external view returns (address bidder, uint256 bidPrice, uint64 etaSeconds, bytes32 metaHash, bool exists)',
  'function taskCounter() external view returns (uint256)',
  'function verifiers(uint256 taskId, uint256 index) external view returns (address)',
  'function approvalCount(uint256 taskId) external view returns (uint8)',
  'function rejectionCount(uint256 taskId) external view returns (uint8)',
  'function hasApproved(uint256 taskId, address voter) external view returns (bool)',
  'function hasRejected(uint256 taskId, address voter) external view returns (bool)',
  'event TaskOpen(uint256 indexed taskId, uint256 totalEscrow, uint256 sellerBudget, uint256 verifierPool, uint64 bidDeadline)',
  'event BidPlaced(uint256 indexed taskId, address indexed bidder, uint256 bidPrice, uint64 etaSeconds)',
  'event AuctionFinalized(uint256 indexed taskId, address indexed seller, uint256 winningBid, uint256 refundToBuyer)',
  'event ResultSubmitted(uint256 indexed taskId, address indexed seller, bytes32 resultHash, string resultURI)',
  'event QuorumReached(uint256 indexed taskId)',
  'event TaskFinalized(uint256 indexed taskId)',
];

// ── State enum labels ─────────────────────────
export const STATE_LABELS = [
  'NONE', 'CREATED', 'ACCEPTED', 'SUBMITTED',
  'QUORUM_APPROVED', 'REJECTED', 'FINALIZED',
  'TIMEOUT_REFUNDED', 'DISPUTED', 'RESOLVED'
];

// ── Provider (read-only) ──────────────────────
export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

// ── Signer from private key ───────────────────
// Pass PRIVATE_KEY as env var: PRIVATE_KEY=0x... node my-scripts/xxx.js
export function getSigner() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('Set PRIVATE_KEY env var. e.g.  PRIVATE_KEY=0x... node script.js');
  return new ethers.Wallet(key, getProvider());
}

// ── Contract instances ────────────────────────
export function registry(signerOrProvider) {
  return new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signerOrProvider);
}

export function escrow(signerOrProvider) {
  return new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signerOrProvider);
}

// ── Pretty print helpers ──────────────────────
export function fmt(wei) {
  return ethers.formatEther(wei) + ' ETH';
}

export function printTask(id, t) {
  console.log(`\n  ┌─ Task #${id} ${'─'.repeat(40)}`);
  console.log(`  │  State:        ${STATE_LABELS[t.state] ?? t.state}`);
  console.log(`  │  Buyer:        ${t.buyer}`);
  console.log(`  │  Seller:       ${t.seller === ethers.ZeroAddress ? '(none yet)' : t.seller}`);
  console.log(`  │  Price:        ${fmt(t.price)}`);
  console.log(`  │  Seller Bdgt:  ${fmt(t.sellerBudget)}`);
  console.log(`  │  V-Pool:       ${fmt(t.verifierPool)}`);
  console.log(`  │  Bid Deadline: ${new Date(Number(t.bidDeadline) * 1000).toISOString()}`);
  console.log(`  │  Job Deadline: ${new Date(Number(t.deadline) * 1000).toISOString()}`);
  console.log(`  │  Quorum:       ${t.quorumM}/${t.quorumN}`);
  if (t.resultURI) console.log(`  │  Result URI:   ${t.resultURI}`);
  console.log(`  └${'─'.repeat(48)}`);
}
