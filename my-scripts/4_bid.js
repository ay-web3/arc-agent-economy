// ─────────────────────────────────────────────
//  4_bid.js  — Seller places a bid on a task
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/4_bid.js <taskId> <bidETH> [etaSecs]
//
//  Example:
//    PRIVATE_KEY=0x... node my-scripts/4_bid.js 5 0.04 3600
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getSigner, escrow, registry, fmt, STATE_LABELS } from './config.js';

async function main() {
  const [,, taskIdArg, bidEthArg, etaArg] = process.argv;

  if (!taskIdArg || !bidEthArg) {
    console.log('Usage:  PRIVATE_KEY=0x... node my-scripts/4_bid.js <taskId> <bidETH> [etaSecs]');
    process.exit(1);
  }

  const taskId   = BigInt(taskIdArg);
  const bidWei   = ethers.parseEther(bidEthArg);
  const etaSecs  = BigInt(etaArg ?? 3600);

  const signer = getSigner();
  const esc    = escrow(signer);
  const reg    = registry(signer);
  const addr   = await signer.getAddress();

  // Pre-flight checks
  console.log('\n⚔️  ARC AGENT ECONOMY — PLACE BID');
  console.log('═'.repeat(50));
  console.log(`   Bidder:  ${addr}`);
  console.log(`   Task #:  ${taskId}`);
  console.log(`   Bid:     ${fmt(bidWei)}`);
  console.log(`   ETA:     ${Number(etaSecs) / 3600}h`);

  const isSeller = await reg.isSeller(addr);
  const stake    = await reg.availableStake(addr);
  const minS     = await reg.minSellerStake();

  console.log(`\n   Seller role: ${isSeller}`);
  console.log(`   Available stake: ${fmt(stake)} (min: ${fmt(minS)})`);

  if (!isSeller) {
    console.error('\n❌ You are not registered as a Seller.');
    console.error('   Run:  node my-scripts/2_register.js seller <stakeETH>');
    process.exit(1);
  }
  if (stake < minS) {
    console.error(`\n❌ Stake too low. Have ${fmt(stake)}, need ${fmt(minS)}`);
    process.exit(1);
  }

  // Check task state
  const task = await esc.tasks(taskId);
  if (task.state !== 1n) { // CREATED = 1
    console.error(`\n❌ Task #${taskId} is not accepting bids (state: ${STATE_LABELS[task.state]})`);
    process.exit(1);
  }
  if (bidWei > task.sellerBudget) {
    console.error(`\n❌ Bid (${fmt(bidWei)}) exceeds seller budget (${fmt(task.sellerBudget)})`);
    process.exit(1);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now >= task.bidDeadline) {
    console.error('\n❌ Bidding window has closed');
    process.exit(1);
  }

  const remaining = Number(task.bidDeadline - now);
  console.log(`\n   Bid window closes in: ${Math.floor(remaining / 60)}m ${remaining % 60}s`);
  console.log(`   Task seller budget:   ${fmt(task.sellerBudget)}`);

  const metaHash = ethers.keccak256(ethers.toUtf8Bytes(`bid:${addr}:${taskId}:${bidWei}`));

  console.log('\n   📡 Broadcasting placeBid tx...');
  const tx = await esc.placeBid(taskId, bidWei, etaSecs, metaHash);

  console.log(`   TX Hash: ${tx.hash}`);
  console.log('   ⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block #${receipt.blockNumber}`);

  console.log('\n🎯 BID PLACED SUCCESSFULLY');
  console.log(`   Your bid of ${fmt(bidWei)} is live on Task #${taskId}`);
  console.log('\n💡 Next steps:');
  console.log('   • Buyer selects winner, or auction auto-finalizes after bid deadline');
  console.log(`   • If selected, submit work: node my-scripts/5_submit_work.js ${taskId} "<result>" <resultURI>`);
  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.reason ?? err.message);
  process.exit(1);
});
