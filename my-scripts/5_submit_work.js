// ─────────────────────────────────────────────
//  5_submit_work.js  — Seller submits work
//  Commits resultHash + URI to the escrow contract.
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/5_submit_work.js <taskId> "<result>" <resultURI>
//
//  Example:
//    PRIVATE_KEY=0x... node my-scripts/5_submit_work.js 5 \
//      "BTC 7-day vol: 3.4%. Bearish divergence on MACD." \
//      "https://ipfs.io/ipfs/Qm..."
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getSigner, escrow, fmt, STATE_LABELS } from './config.js';

async function main() {
  const [,, taskIdArg, result, resultURI] = process.argv;

  if (!taskIdArg || !result || !resultURI) {
    console.log('Usage:  PRIVATE_KEY=0x... node my-scripts/5_submit_work.js <taskId> "<result>" <resultURI>');
    process.exit(1);
  }

  const taskId = BigInt(taskIdArg);
  const signer = getSigner();
  const esc    = escrow(signer);
  const addr   = await signer.getAddress();

  console.log('\n⚔️  ARC AGENT ECONOMY — SUBMIT WORK');
  console.log('═'.repeat(50));
  console.log(`   Seller:    ${addr}`);
  console.log(`   Task #:    ${taskId}`);
  console.log(`   Result:    "${result.slice(0, 80)}${result.length > 80 ? '...' : ''}"`);
  console.log(`   URI:       ${resultURI}`);

  // Pre-flight
  const task = await esc.tasks(taskId);

  if (task.state !== 2n) { // ACCEPTED = 2
    console.error(`\n❌ Task #${taskId} is not in ACCEPTED state (current: ${STATE_LABELS[task.state]})`);
    process.exit(1);
  }
  if (task.seller.toLowerCase() !== addr.toLowerCase()) {
    console.error(`\n❌ You (${addr}) are not the assigned seller for this task.`);
    console.error(`   Assigned seller: ${task.seller}`);
    process.exit(1);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now > task.deadline) {
    console.error('\n❌ Job deadline has passed — buyer can now claim a timeout refund.');
    process.exit(1);
  }

  const timeLeft = Number(task.deadline - now);
  console.log(`\n   Task price:     ${fmt(task.price)}`);
  console.log(`   Time remaining: ${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s`);

  // Hash the result content
  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(result));
  console.log(`   Result Hash:    ${resultHash}`);

  console.log('\n   📡 Broadcasting submitResult tx...');
  const tx = await esc.submitResult(taskId, resultHash, resultURI);

  console.log(`   TX Hash: ${tx.hash}`);
  console.log('   ⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block #${receipt.blockNumber}`);

  console.log('\n🎯 WORK SUBMITTED SUCCESSFULLY');
  console.log(`   Result hash committed on-chain for Task #${taskId}`);
  console.log(`   Verifiers now have until ${new Date(Number(task.verifierDeadline) * 1000).toISOString()} to vote`);
  console.log('\n💡 Next steps:');
  console.log('   • Verifiers approve/reject: node my-scripts/6_verify.js <taskId> approve');
  console.log('   • Check status:             node my-scripts/1_status.js');
  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.reason ?? err.message);
  process.exit(1);
});
