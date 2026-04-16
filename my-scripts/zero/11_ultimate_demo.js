// ─────────────────────────────────────────────
//  11_ultimate_demo.js  —  The Ultimate ARC Hackathon Demo
//
//  FLOW:
//  1. Agent A (Buyer) creates a BTC analysis task.
//  2. Agent B (Seller) bids on the task.
//  3. Buyer selects Agent B.
//  4. Agent B calls Paymind POST /analysis (x402).
//  5. Paymind triggers x402 payment + Gemini analysis.
//  6. Agent B submits the result back to ARC.
//
//  Usage:
//    node my-scripts/zero/11_ultimate_demo.js
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import {
  loadIdentity, orchestrate, orchestrateGet,
  getProvider, REGISTRY_ADDRESS, ESCROW_ADDRESS,
  STATE_LABELS, fmt, ensureAgentWallet, getPaymindAnalysis
} from './zero-config.js';
import axios from 'axios';

const TASK_DESCRIPTION = 'High-fidelity Bitcoin (BTC) market analysis with 1h timeframe candle structure and AI narration.';

const REGISTRY_ABI = [
  'function isSeller(address) external view returns (bool)',
  'function availableStake(address) external view returns (uint256)',
  'function minSellerStake() external view returns (uint256)',
];
const ESCROW_ABI = [
  'function tasks(uint256) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, uint64 verifierDeadline, uint64 approvalTimestamp, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)',
  'function taskCounter() external view returns (uint256)',
];

function step(n, label) {
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  PHASE ${n} · ${label}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

async function main() {
  const buyerId    = loadIdentity(); // Use existing identity as Buyer
  const provider   = getProvider();
  const reg        = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const esc        = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   🏆  THE ULTIMATE ARC AGENT ECONOMY DEMO            ║');
  console.log('║   Zero-Secret · Circle HSM · Paymind x402 · Gemini   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // ══════════════════════════════════════════
  step(1, 'PROVISIONING THE ELITE SELLER');
  // ══════════════════════════════════════════
  
  // For the demo, we'll provision a NEW Agent specifically to be our "Paymind Agent"
  console.log('\n   Onboarding a specialized "Paymind Expert" agent...');
  const onboardRes = await axios.post('https://arc-agent-economy-156980607075.europe-west1.run.app/onboard', { 
    agentName: `paymind-expert-${Math.floor(Math.random()*1000)}` 
  });
  const sellerId = onboardRes.data;
  
  console.log(`   Seller Identity: ${sellerId.agentId}`);
  console.log(`   Seller Wallet:   ${sellerId.address}`);

  // Register the seller if needed
  const isS = await reg.isSeller(sellerId.address);
  if (!isS) {
    console.log('   Registering seller on-chain (Orchestrator sponsored)...');
    await orchestrate('execute/register', {
      asSeller: true, asVerifier: false,
      capHash: ethers.id(`cap:${sellerId.agentId}`),
      pubKey: ethers.id(`pub:${sellerId.address}`),
      stake: '50.0'
    }, sellerId);
    await new Promise(r => setTimeout(r, 6000));
  }

  // Ensure AgentWallet exists for x402
  const agentWallet = await ensureAgentWallet(sellerId);
  console.log(`   Agent Wallet:    ${agentWallet} ✅`);

  // ══════════════════════════════════════════
  step(2, 'CREATING THE BTC ANALYSIS TASK');
  // ══════════════════════════════════════════

  const now      = Math.floor(Date.now() / 1000);
  const taskHash = ethers.id(TASK_DESCRIPTION);

  console.log(`\n   Buyer "${buyerId.agentId}" posting task...`);
  const taskResult = await orchestrate('execute/createOpenTask', {
    jobDeadline:      now + 1800,
    bidDeadline:      now + 300,
    verifierDeadline: now + 3600,
    taskHash,
    verifiers:  [buyerId.address], // Buyer will act as verifier too for speed
    quorumM:    1,
    amount:     '5.0'
  }, buyerId);

  const taskId = taskResult.taskId;
  console.log(`   ✅ Task Created: #${taskId}`);
  
  // Wait for indexer/chain
  await new Promise(r => setTimeout(r, 5000));

  // ══════════════════════════════════════════
  step(3, 'BIDDING & SELECTION');
  // ══════════════════════════════════════════

  console.log(`\n   Paymind Expert bidding on task #${taskId}...`);
  await orchestrate('execute/placeBid', {
    taskId: taskId.toString(),
    price: '4.5',
    eta: 1800,
    meta: ethers.id(`bid:${sellerId.agentId}`)
  }, sellerId);
  console.log('   ✅ Bid Placed.');

  await new Promise(r => setTimeout(r, 4000));

  console.log('\n   Buyer selecting Paymind Expert as winner...');
  await orchestrate('execute/finalizeAuction', {
    taskId: taskId.toString()
  }, buyerId);
  console.log('   ✅ Seller assigned.');
  
  await new Promise(r => setTimeout(r, 6000));

  // ══════════════════════════════════════════
  step(4, 'AI EXECUTION: THE COMMERCE BRIDGE');
  // ══════════════════════════════════════════

  console.log('\n   Paymind Agent needs high-fidelity Bitcoin data.');
  console.log('   Calling Paymind POST /analysis (triggers x402 payment)...');

  const analysis = await getPaymindAnalysis(sellerId, 'bitcoin');

  console.log('\n   💎 Analysis Result Unlocked:');
  console.log(`   Price: $${analysis.price}`);
  console.log(`   Confidence: ${analysis.confidence}%`);
  console.log(`\n   AI Summary:\n   "${analysis.analysis.slice(0, 300)}..."`);

  // ══════════════════════════════════════════
  step(5, 'RESULT SUBMISSION');
  // ══════════════════════════════════════════

  const resultHash = ethers.id(analysis.analysis);
  const resultURI  = `https://paymind.io/report/${taskId}/${resultHash.slice(0,10)}`;

  console.log(`\n   Submitting expert work to ARC TaskEscrow...`);
  await orchestrate('execute/submitResult', {
    taskId:     taskId.toString(),
    hash:       resultHash,
    resultHash: resultHash,
    uri:        resultURI,
    resultURI:  resultURI
  }, sellerId);
  
  console.log(`   ✅ Work Submitted.`);
  console.log(`   URI: ${resultURI}`);

  // ══════════════════════════════════════════
  step(6, 'DEMO COMPLETE');
  // ══════════════════════════════════════════

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   🏆  SUCCESS!                                       ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║   Economic Lifecycle Proven:                          ║');
  console.log('║   1. Agent Earned (Future payout from TaskEscrow)    ║');
  console.log('║   2. Agent Paid (Used USDC for x402 data)            ║');
  console.log('║   3. Agent Delivered (AI-powered professional work)  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n✅ Mission Accomplished.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal Error during Ultimate Demo:', err.response?.data?.error ?? err.message);
  process.exit(1);
});
