// ─────────────────────────────────────────────
//  1_status.js  — Read-only. No wallet needed.
//  Scans the chain and prints a full economy snapshot.
//
//  Usage:  node my-scripts/1_status.js
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getProvider, registry, escrow, STATE_LABELS, fmt, printTask } from './config.js';

const SCAN_LAST_N_TASKS = 10; // show the most recent N tasks

async function main() {
  const provider = getProvider();
  const reg      = registry(provider);
  const esc      = escrow(provider);

  console.log('\n⚔️  ARC AGENT ECONOMY — LIVE CHAIN STATUS');
  console.log('═'.repeat(50));

  // ── Network ──────────────────────────────
  const network = await provider.getNetwork();
  const block   = await provider.getBlockNumber();
  console.log(`\n🌐 Network:  Chain ${network.chainId}  |  Block #${block}`);

  // ── Registry globals ─────────────────────
  const minSeller   = await reg.minSellerStake();
  const minVerifier = await reg.minVerifierStake();
  const cooldown    = await reg.withdrawCooldown();

  console.log('\n📋 REGISTRY CONFIG');
  console.log(`   Min Seller Stake:   ${fmt(minSeller)}`);
  console.log(`   Min Verifier Stake: ${fmt(minVerifier)}`);
  console.log(`   Withdraw Cooldown:  ${Number(cooldown) / 3600}h`);

  // ── Task counter ──────────────────────────
  const total = await esc.taskCounter();
  console.log(`\n📦 TASKS ON-CHAIN:  ${total.toString()} total`);

  if (total === 0n) {
    console.log('   (no tasks created yet)');
    return;
  }

  // ── Scan tasks ────────────────────────────
  const from = total > BigInt(SCAN_LAST_N_TASKS)
    ? total - BigInt(SCAN_LAST_N_TASKS) + 1n
    : 1n;

  const stateCounts = {};
  STATE_LABELS.forEach(l => (stateCounts[l] = 0));

  console.log(`\n   Showing tasks #${from} → #${total}:\n`);

  for (let id = from; id <= total; id++) {
    try {
      const t = await esc.tasks(id);
      printTask(id.toString(), t);
      stateCounts[STATE_LABELS[t.state]]++;
    } catch (e) {
      console.log(`   Task #${id}: (read error — ${e.shortMessage ?? e.message})`);
    }
  }

  // ── Summary ───────────────────────────────
  console.log('\n📊 STATE BREAKDOWN (last ' + SCAN_LAST_N_TASKS + ' tasks)');
  for (const [label, count] of Object.entries(stateCounts)) {
    if (count > 0) console.log(`   ${label.padEnd(18)} ${count}`);
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.message);
  process.exit(1);
});
