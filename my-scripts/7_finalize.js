// ─────────────────────────────────────────────
//  7_finalize.js  — Finalize a quorum-approved task
//  Pays seller, verifiers, treasury & caller bonus.
//  Can only run after 1hr cooling-off window.
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/7_finalize.js <taskId>
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getSigner, escrow, fmt, STATE_LABELS } from './config.js';

async function main() {
  const [,, taskIdArg] = process.argv;

  if (!taskIdArg) {
    console.log('Usage:  PRIVATE_KEY=0x... node my-scripts/7_finalize.js <taskId>');
    process.exit(1);
  }

  const taskId = BigInt(taskIdArg);
  const signer = getSigner();
  const esc    = escrow(signer);
  const addr   = await signer.getAddress();

  console.log('\n⚔️  ARC AGENT ECONOMY — FINALIZE TASK');
  console.log('═'.repeat(50));
  console.log(`   Finalizer: ${addr}`);
  console.log(`   Task #:    ${taskId}`);

  const task = await esc.tasks(taskId);

  if (task.state !== 4n) { // QUORUM_APPROVED = 4
    console.error(`\n❌ Task #${taskId} is not QUORUM_APPROVED (current: ${STATE_LABELS[task.state]})`);
    if (task.state === 6n) console.log('   ℹ️  Task is already FINALIZED.');
    process.exit(1);
  }

  const now         = BigInt(Math.floor(Date.now() / 1000));
  const coolingEnd  = task.approvalTimestamp + 3600n;
  const waitSecs    = coolingEnd > now ? Number(coolingEnd - now) : 0;

  if (coolingEnd > now) {
    console.error(`\n⏳ Still in cooling-off window.`);
    console.error(`   Can finalize in: ${Math.ceil(waitSecs / 60)} minutes`);
    console.error(`   Ready at:        ${new Date(Number(coolingEnd) * 1000).toISOString()}`);
    process.exit(1);
  }

  console.log(`\n   Price:         ${fmt(task.price)}`);
  console.log(`   Verifier Pool: ${fmt(task.verifierPool)}`);
  console.log(`   Seller:        ${task.seller}`);
  console.log(`   Quorum:        ${task.quorumM}/${task.quorumN}`);
  console.log(`   Cooling-off:   ✅ Passed`);
  console.log(`\n   📡 Broadcasting finalize tx...`);

  const tx = await esc.finalize(taskId);

  console.log(`   TX Hash: ${tx.hash}`);
  console.log('   ⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block #${receipt.blockNumber}`);

  // Parse TaskFinalized event
  const iface = esc.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'TaskFinalized') {
        const protocolFeeBps = 200n;
        const fee            = (task.price * protocolFeeBps) / 10000n;
        const sellerPayout   = task.price - fee;
        const treasuryShare  = (fee * 6000n) / 10000n;
        const finalizerShare = fee - treasuryShare;

        console.log('\n💰 PAYOUTS');
        console.log(`   Seller:    ${fmt(sellerPayout)}`);
        console.log(`   Treasury:  ${fmt(treasuryShare)}`);
        console.log(`   You (Finalizer bonus): ${fmt(finalizerShare)}`);
        if (task.quorumM > 0n && task.verifierPool > 0n) {
          const perVerifier = task.verifierPool / task.quorumM;
          console.log(`   Verifiers: ${fmt(perVerifier)} each (${task.quorumM} approvers)`);
        }
      }
    } catch (_) {}
  }

  console.log('\n🏆 TASK FINALIZED — Economy settled on-chain.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.reason ?? err.message);
  process.exit(1);
});
