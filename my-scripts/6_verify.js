// ─────────────────────────────────────────────
//  6_verify.js  — Verifier approves or rejects work
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/6_verify.js <taskId> <approve|reject>
//
//  Example:
//    PRIVATE_KEY=0x... node my-scripts/6_verify.js 5 approve
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getSigner, escrow, registry, fmt, STATE_LABELS } from './config.js';

async function main() {
  const [,, taskIdArg, voteArg] = process.argv;

  if (!taskIdArg || !voteArg) {
    console.log('Usage:  PRIVATE_KEY=0x... node my-scripts/6_verify.js <taskId> <approve|reject>');
    process.exit(1);
  }

  if (voteArg !== 'approve' && voteArg !== 'reject') {
    console.error('❌ Vote must be "approve" or "reject"');
    process.exit(1);
  }

  const taskId   = BigInt(taskIdArg);
  const isApprove = voteArg === 'approve';
  const signer   = getSigner();
  const esc      = escrow(signer);
  const reg      = registry(signer);
  const addr     = await signer.getAddress();

  console.log('\n⚔️  ARC AGENT ECONOMY — VERIFY WORK');
  console.log('═'.repeat(50));
  console.log(`   Verifier: ${addr}`);
  console.log(`   Task #:   ${taskId}`);
  console.log(`   Vote:     ${isApprove ? '✅ APPROVE' : '❌ REJECT'}`);

  // Pre-flight
  const isVerifier = await reg.isVerifier(addr);
  const stake      = await reg.availableStake(addr);
  const minV       = await reg.minVerifierStake();

  console.log(`\n   Verifier role: ${isVerifier}`);
  console.log(`   Available stake: ${fmt(stake)} (min: ${fmt(minV)})`);

  if (!isVerifier) {
    console.error('\n❌ You are not registered as a Verifier.');
    console.error('   Run:  node my-scripts/2_register.js verifier <stakeETH>');
    process.exit(1);
  }
  if (stake < minV) {
    console.error(`\n❌ Stake too low. Have ${fmt(stake)}, need ${fmt(minV)}`);
    process.exit(1);
  }

  const task = await esc.tasks(taskId);

  if (task.state !== 3n) { // SUBMITTED = 3
    console.error(`\n❌ Task #${taskId} is not in SUBMITTED state (current: ${STATE_LABELS[task.state]})`);
    process.exit(1);
  }

  // Check if this address is in the verifier set
  const alreadyApproved = await esc.hasApproved(taskId, addr);
  const alreadyRejected = await esc.hasRejected(taskId, addr);
  if (alreadyApproved || alreadyRejected) {
    console.error('\n❌ You have already voted on this task.');
    process.exit(1);
  }

  const approvals    = await esc.approvalCount(taskId);
  const rejections   = await esc.rejectionCount(taskId);
  const quorumNeeded = task.quorumM;

  console.log(`\n   Result URI:  ${task.resultURI}`);
  console.log(`   Result Hash: ${task.resultHash}`);
  console.log(`   Approvals:   ${approvals}/${quorumNeeded} needed`);
  console.log(`   Rejections:  ${rejections}/${quorumNeeded} needed`);

  console.log(`\n   📡 Broadcasting ${voteArg} tx...`);
  const tx = isApprove
    ? await esc.approve(taskId)
    : await esc.reject(taskId);

  console.log(`   TX Hash: ${tx.hash}`);
  console.log('   ⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block #${receipt.blockNumber}`);

  // Check for QuorumReached or TaskRejected events
  const iface = esc.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'QuorumReached') {
        console.log('\n🏆 QUORUM REACHED! Task approved by verifiers.');
        console.log('   After 1hr cooling-off period, anyone can finalize:');
        console.log(`   node my-scripts/7_finalize.js ${taskId}`);
      }
      if (parsed?.name === 'TaskRejected') {
        console.log('\n⚠️  TASK REJECTED by verifier quorum.');
        console.log('   Buyer or seller can open a dispute, or buyer reclaims funds.');
      }
    } catch (_) {}
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.reason ?? err.message);
  process.exit(1);
});
