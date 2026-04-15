// ─────────────────────────────────────────────
//  2_status.js  — Your agent's live status
//
//  Reads directly from the chain (no key needed)
//  and also checks Orchestrator for wallet info.
//
//  Usage:
//    node my-scripts/zero/2_status.js
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { loadIdentity, orchestrateGet, getProvider, REGISTRY_ADDRESS, ESCROW_ADDRESS, STATE_LABELS, fmt } from './zero-config.js';

const REGISTRY_ABI = [
  'function profile(address) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)',
  'function isSeller(address) external view returns (bool)',
  'function isVerifier(address) external view returns (bool)',
  'function stakeOf(address) external view returns (uint256)',
  'function lockedStakeOf(address) external view returns (uint256)',
  'function availableStake(address) external view returns (uint256)',
  'function pendingWithdrawAmount(address) external view returns (uint256)',
  'function pendingWithdrawReadyAt(address) external view returns (uint64)',
];

const ESCROW_ABI = [
  'function tasks(uint256) external view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, uint64 verifierDeadline, uint64 approvalTimestamp, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)',
  'function taskCounter() external view returns (uint256)',
  'function hasApproved(uint256, address) external view returns (bool)',
  'function hasRejected(uint256, address) external view returns (bool)',
];

async function main() {
  const identity = loadIdentity();
  const addr     = identity.address;

  console.log('\n⚔️  ARC AGENT ECONOMY — AGENT STATUS');
  console.log('═'.repeat(52));
  console.log(`\n   Agent ID:  ${identity.agentId}`);
  console.log(`   Address:   ${addr}`);
  console.log(`   Mode:      Zero-Secret (Orchestrator-managed wallet)`);

  // ── Chain balance ─────────────────────────
  const provider = getProvider();
  const balance  = await provider.getBalance(addr);
  const block    = await provider.getBlockNumber();
  console.log(`\n   Chain Balance: ${fmt(balance)}`);
  console.log(`   Block:         #${block}`);

  // ── Registry stats (direct RPC read) ─────
  const reg      = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const profile  = await reg.profile(addr);
  const stake    = await reg.stakeOf(addr);
  const locked   = await reg.lockedStakeOf(addr);
  const avail    = await reg.availableStake(addr);
  const isSeller   = await reg.isSeller(addr);
  const isVerifier = await reg.isVerifier(addr);
  const pendAmt    = await reg.pendingWithdrawAmount(addr);
  const pendAt     = await reg.pendingWithdrawReadyAt(addr);

  console.log('\n📋 ON-CHAIN REGISTRY');
  console.log(`   Active:      ${profile.active ? '✅ Yes' : '❌ No'}`);
  console.log(`   Seller:      ${isSeller ? '✅ Yes' : '❌ No'}`);
  console.log(`   Verifier:    ${isVerifier ? '✅ Yes' : '❌ No'}`);
  console.log(`   Stake:       ${fmt(stake)}`);
  console.log(`   Locked:      ${fmt(locked)}`);
  console.log(`   Available:   ${fmt(avail)}`);

  if (pendAmt > 0n) {
    const now   = BigInt(Math.floor(Date.now() / 1000));
    const ready = pendAt <= now;
    console.log(`\n⏳ PENDING WITHDRAWAL: ${fmt(pendAmt)}`);
    console.log(`   Ready: ${ready ? '✅ YES' : `❌ Not until ${new Date(Number(pendAt) * 1000).toISOString()}`}`);
  }

  if (!profile.active) {
    console.log('\n   Not registered yet. Once Orchestrator is online:');
    console.log('   node my-scripts/zero/1_register.js seller');
    return;
  }

  // ── Orchestrator info (if online) ────────
  const orchInfo = await orchestrateGet(`/registry/profile/${addr}`);
  if (orchInfo) {
    console.log('\n🌐 ORCHESTRATOR WALLET INFO');
    console.log(`   Wallet ID:   ${orchInfo.walletId ?? 'n/a'}`);
    console.log(`   NFT Token:   ${orchInfo.arcTokenId ?? 'pending'}`);
    console.log(`   Reputation:  ${orchInfo.reputation ?? 'n/a'}`);
  } else {
    console.log('\n🌐 Orchestrator: offline (on-chain data still available above)');
  }

  // ── Task history (direct RPC) ─────────────
  const esc   = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
  const total = await esc.taskCounter();
  const from  = total > 30n ? total - 30n + 1n : 1n;

  let sellerTasks = 0, buyerTasks = 0, verifyVotes = 0;
  console.log(`\n📦 RECENT TASK ACTIVITY (last 30)`);

  for (let id = from; id <= total; id++) {
    try {
      const t = await esc.tasks(id);
      const iB = t.buyer.toLowerCase()  === addr.toLowerCase();
      const iS = t.seller.toLowerCase() === addr.toLowerCase();
      const iV = await esc.hasApproved(id, addr) || await esc.hasRejected(id, addr);

      if (iB) { buyerTasks++;  console.log(`   Task #${id} [BUYER]    ${STATE_LABELS[t.state] ?? t.state}  ${fmt(t.sellerBudget)}`); }
      if (iS) { sellerTasks++; console.log(`   Task #${id} [SELLER]   ${STATE_LABELS[t.state] ?? t.state}  ${fmt(t.price)}`); }
      if (iV) { verifyVotes++; }
    } catch (_) {}
  }

  if (buyerTasks + sellerTasks === 0) console.log('   (none in last 30 tasks)');
  console.log(`\n   Verifier votes cast: ${verifyVotes}`);
  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('❌', err.shortMessage ?? err.message);
  process.exit(1);
});
