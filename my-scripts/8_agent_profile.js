// ─────────────────────────────────────────────
//  8_agent_profile.js  — Inspect any agent wallet
//  Shows full on-chain profile: stake, roles, tasks.
//
//  Usage:
//    node my-scripts/8_agent_profile.js <walletAddress>
//    node my-scripts/8_agent_profile.js   (uses PRIVATE_KEY address)
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import {
  getProvider, getSigner, registry, escrow,
  fmt, STATE_LABELS
} from './config.js';

async function main() {
  const [,, addrArg] = process.argv;

  let addr;
  const provider = getProvider();

  if (addrArg) {
    if (!ethers.isAddress(addrArg)) {
      console.error(`❌ Invalid address: ${addrArg}`);
      process.exit(1);
    }
    addr = addrArg;
  } else {
    // Fallback to signer address
    const signer = getSigner();
    addr = await signer.getAddress();
  }

  const reg = registry(provider);
  const esc = escrow(provider);

  console.log('\n⚔️  ARC AGENT ECONOMY — AGENT PROFILE');
  console.log('═'.repeat(50));
  console.log(`   Address: ${addr}`);

  // ── On-chain balance ──────────────────────
  const balance = await provider.getBalance(addr);
  console.log(`   Balance: ${fmt(balance)}`);

  // ── Registry profile ──────────────────────
  const profile    = await reg.profile(addr);
  const stake      = await reg.stakeOf(addr);
  const locked     = await reg.lockedStakeOf(addr);
  const available  = await reg.availableStake(addr);
  const isSeller   = await reg.isSeller(addr);
  const isVerifier = await reg.isVerifier(addr);
  const pendingAmt = await reg.pendingWithdrawAmount(addr);
  const pendingAt  = await reg.pendingWithdrawReadyAt(addr);

  console.log('\n📋 REGISTRY STATUS');
  console.log(`   Active:        ${profile.active}`);
  console.log(`   Role — Seller:   ${isSeller}`);
  console.log(`   Role — Verifier: ${isVerifier}`);
  console.log(`   Total Stake:   ${fmt(stake)}`);
  console.log(`   Locked:        ${fmt(locked)}`);
  console.log(`   Available:     ${fmt(available)}`);

  if (profile.active) {
    console.log(`   Cap Hash:      ${profile.capabilitiesHash}`);
  }

  if (pendingAmt > 0n) {
    const now     = BigInt(Math.floor(Date.now() / 1000));
    const ready   = pendingAt <= now;
    console.log(`\n⏳ PENDING WITHDRAWAL`);
    console.log(`   Amount: ${fmt(pendingAmt)}`);
    console.log(`   Ready:  ${ready ? '✅ YES — run 7_finalize withdraw' : `❌ Not yet (${new Date(Number(pendingAt) * 1000).toISOString()})`}`);
  }

  if (!profile.active) {
    console.log('\n   ℹ️  Not yet registered. Run: node my-scripts/2_register.js seller <stakeETH>');
    return;
  }

  // ── Scan tasks involving this agent ───────
  const total = await esc.taskCounter();
  if (total === 0n) {
    console.log('\n📦 No tasks on-chain yet.');
    return;
  }

  console.log(`\n📦 TASKS INVOLVING ${addr.slice(0, 10)}...`);

  let found = 0;
  const from = total > 30n ? total - 30n + 1n : 1n;

  for (let id = from; id <= total; id++) {
    try {
      const t = await esc.tasks(id);
      const isBuyer    = t.buyer.toLowerCase()  === addr.toLowerCase();
      const isSellTask = t.seller.toLowerCase() === addr.toLowerCase();

      if (!isBuyer && !isSellTask) continue;
      found++;

      const role  = isBuyer ? 'BUYER' : 'SELLER';
      const state = STATE_LABELS[t.state] ?? String(t.state);
      const value = isSellTask ? fmt(t.price) : fmt(t.sellerBudget);

      console.log(`\n   Task #${id} [${role}]`);
      console.log(`     State:  ${state}`);
      console.log(`     Value:  ${value}`);
      if (t.resultURI) console.log(`     URI:    ${t.resultURI}`);
    } catch (_) {}
  }

  if (found === 0) console.log('   (none in last 30 tasks)');

  // ── Verifier activity ─────────────────────
  if (isVerifier) {
    console.log(`\n🔍 VERIFIER VOTES (last 30 tasks)`);
    let vFound = 0;
    for (let id = from; id <= total; id++) {
      try {
        const approved = await esc.hasApproved(id, addr);
        const rejected = await esc.hasRejected(id, addr);
        if (approved || rejected) {
          vFound++;
          console.log(`   Task #${id}: ${approved ? '✅ Approved' : '❌ Rejected'}`);
        }
      } catch (_) {}
    }
    if (vFound === 0) console.log('   (no votes cast in last 30 tasks)');
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.message);
  process.exit(1);
});
