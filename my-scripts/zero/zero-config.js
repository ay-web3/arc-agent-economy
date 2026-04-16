// ─────────────────────────────────────────────
//  zero-config.js  — Shared config for Zero-Secret scripts
//
//  HOW THIS WORKS:
//  Your agent has NO private key.
//  Instead it has a .agent_secret file with:
//    { agentId, agentSecret, address }
//
//  The Orchestrator (Swarm Master) holds the
//  Circle HSM wallets and signs everything.
//  The agent only needs its agentSecret to
//  authenticate with the Orchestrator.
// ─────────────────────────────────────────────
import axios from 'axios';
import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { ArcManagedSDK } from '../../arc-sdk/src/ArcManagedSDK.js';

// ── Orchestrator URL ──────────────────────────
export const ORCHESTRATOR = 'https://arc-agent-economy-156980607075.europe-west1.run.app';

// Initialize SDK instance
const sdk = new ArcManagedSDK({ orchestratorUrl: ORCHESTRATOR });

// ── RPC (read-only chain access) ──────────────
export const RPC_URL = 'https://rpc.testnet.arc.network';

// ── Deployed Contracts ───────────────────────
export const REGISTRY_ADDRESS      = '0x8b8c8c03eee05334412c73b298705711828e9ca1';
export const ESCROW_ADDRESS        = '0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c';
export const AGENT_MANAGER_ADDRESS = '0xc4e39579dc794cc9d65ba4266a39718e2778f8e9';
export const X402_ADDRESS          = '0x12d6DaaD7d9f86221e5920E7117d5848EC0528e6';

// ── State label lookup ────────────────────────
export const STATE_LABELS = [
  'NONE', 'CREATED', 'ACCEPTED', 'SUBMITTED',
  'QUORUM_APPROVED', 'REJECTED', 'FINALIZED',
  'TIMEOUT_REFUNDED', 'DISPUTED', 'RESOLVED'
];

// ── Read-only provider ────────────────────────
export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

// ── Load agent identity from .agent_secret ────
export function loadIdentity(cwd = process.cwd()) {
  const secretPath = join(cwd, '.agent_secret');
  if (!existsSync(secretPath)) {
    console.error('\n❌ No .agent_secret found.');
    console.error('   The Orchestrator must be online to onboard.');
    console.error('   Once online, run:  node my-scripts/zero/0_onboard.js');
    process.exit(1);
  }
  try {
    const data = JSON.parse(readFileSync(secretPath, 'utf8'));
    if (!data.agentId || !data.agentSecret) throw new Error('Missing fields');
    return data; // { agentId, agentSecret, address }
  } catch (e) {
    console.error('❌ Could not parse .agent_secret:', e.message);
    process.exit(1);
  }
}

// ── SDK Wrappers (for script use) ──────────────

export async function orchestrate(endpoint, params = {}, identity = null) {
  // We use the SDK's internal requestAction method (if we were refactoring fully)
  // But for compatibility with existing scripts, we'll keep the direct call 
  // or use the SDK's exposed methods.
  const id = identity ?? loadIdentity();
  try {
    const res = await axios.post(`${ORCHESTRATOR}/${endpoint}`, {
      agentId:     id.agentId,
      agentSecret: id.agentSecret,
      ...params
    });
    return res.data;
  } catch (err) {
    console.error(`\n❌ Orchestrator error: ${err.response?.data?.error ?? err.message}`);
    throw err;
  }
}

/**
 * Creates an AgentWallet via AgentWalletManagerV2
 */
export async function ensureAgentWallet(identity) {
  console.log('   Ensuring AgentWallet exists via SDK...');
  return sdk.createAgentWallet();
}

/**
 * Calls Paymind's Gemini-powered AI analysis via SDK.
 */
export async function getPaymindAnalysis(identity, coin = 'bitcoin') {
  return sdk.getMarketAnalysis(coin);
}

// ── Read from Orchestrator (GET) ──────────────
export async function orchestrateGet(path) {
  try {
    const res = await axios.get(`${ORCHESTRATOR}${path}`);
    return res.data;
  } catch (err) {
    return null;
  }
}

// ── Pretty helpers ────────────────────────────
export function fmt(wei) {
  return ethers.formatEther(wei) + ' ETH';
}

export function printTask(id, t) {
  const state = typeof t.state === 'number'
    ? STATE_LABELS[t.state] ?? t.state
    : t.state;
  console.log(`\n  ┌─ Task #${id} ${'─'.repeat(40)}`);
  console.log(`  │  State:        ${state}`);
  console.log(`  │  Buyer:        ${t.buyer ?? 'unknown'}`);
  console.log(`  │  Seller:       ${t.seller && t.seller !== ethers.ZeroAddress ? t.seller : '(none yet)'}`);
  console.log(`  │  Price:        ${fmt(BigInt(t.price ?? 0))}`);
  console.log(`  │  Seller Bdgt:  ${fmt(BigInt(t.sellerBudget ?? 0))}`);
  console.log(`  │  V-Pool:       ${fmt(BigInt(t.verifierPool ?? 0))}`);
  if (t.bidDeadline)  console.log(`  │  Bid Deadline: ${new Date(Number(t.bidDeadline) * 1000).toISOString()}`);
  if (t.deadline)     console.log(`  │  Job Deadline: ${new Date(Number(t.deadline) * 1000).toISOString()}`);
  if (t.quorumM)      console.log(`  │  Quorum:       ${t.quorumM}/${t.quorumN}`);
  if (t.resultURI)    console.log(`  │  Result URI:   ${t.resultURI}`);
  console.log(`  └${'─'.repeat(48)}`);
}
