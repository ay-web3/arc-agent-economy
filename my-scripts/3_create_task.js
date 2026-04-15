// ─────────────────────────────────────────────
//  3_create_task.js  — Buyer creates a task
//  Posts an open auction task with escrow funds.
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/3_create_task.js \
//      "<task description>" <totalEscrowETH> <verifier1,verifier2,...> <quorumM>
//
//  Example:
//    PRIVATE_KEY=0x... node my-scripts/3_create_task.js \
//      "Analyse BTC volatility and produce a markdown report" 0.1 \
//      0xABC...,0xDEF... 1
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getSigner, escrow, fmt } from './config.js';

const BID_WINDOW_SECS      = 60 * 30;        // 30 min bidding window
const JOB_WINDOW_SECS      = 60 * 60 * 2;    // 2 hr job deadline
const VERIFIER_WINDOW_SECS = 60 * 60 * 3;    // 3 hr verifier deadline

async function main() {
  const [,, description, totalEth, verifiersCsv, quorumArg] = process.argv;

  if (!description || !totalEth || !verifiersCsv || !quorumArg) {
    console.log('Usage:');
    console.log('  PRIVATE_KEY=0x... node my-scripts/3_create_task.js \\');
    console.log('    "<description>" <totalETH> <v1addr,v2addr,...> <quorumM>');
    process.exit(1);
  }

  const verifiers = verifiersCsv.split(',').map(a => a.trim()).filter(Boolean);
  const quorumM   = parseInt(quorumArg, 10);
  const totalWei  = ethers.parseEther(totalEth);

  if (verifiers.length === 0) {
    console.error('❌ Provide at least one verifier address');
    process.exit(1);
  }
  if (quorumM < 1 || quorumM > verifiers.length) {
    console.error(`❌ quorumM must be between 1 and ${verifiers.length}`);
    process.exit(1);
  }

  // Validate addresses
  for (const v of verifiers) {
    if (!ethers.isAddress(v)) {
      console.error(`❌ Invalid address: ${v}`);
      process.exit(1);
    }
  }

  const signer = getSigner();
  const esc    = escrow(signer);
  const addr   = await signer.getAddress();
  const now    = Math.floor(Date.now() / 1000);

  const bidDeadline      = BigInt(now + BID_WINDOW_SECS);
  const jobDeadline      = BigInt(now + JOB_WINDOW_SECS);
  const verifierDeadline = BigInt(now + VERIFIER_WINDOW_SECS);

  // Hash the task description
  const taskHash = ethers.keccak256(ethers.toUtf8Bytes(description));

  console.log('\n⚔️  ARC AGENT ECONOMY — CREATE TASK');
  console.log('═'.repeat(50));
  console.log(`   Buyer:       ${addr}`);
  console.log(`   Description: "${description}"`);
  console.log(`   Task Hash:   ${taskHash}`);
  console.log(`   Escrow:      ${fmt(totalWei)}`);
  console.log(`   Verifiers:   ${verifiers.join(', ')}`);
  console.log(`   Quorum:      ${quorumM}/${verifiers.length}`);
  console.log(`   Bid Window:  ${BID_WINDOW_SECS / 60} min`);
  console.log(`   Job Window:  ${JOB_WINDOW_SECS / 60} min`);

  console.log('\n   📡 Broadcasting createOpenTask tx...');

  const tx = await esc.createOpenTask(
    jobDeadline,
    bidDeadline,
    verifierDeadline,
    taskHash,
    verifiers,
    quorumM,
    { value: totalWei }
  );

  console.log(`   TX Hash: ${tx.hash}`);
  console.log('   ⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block #${receipt.blockNumber}`);

  // Parse TaskOpen event to get task ID
  const iface    = esc.interface;
  let taskId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'TaskOpen') {
        taskId = parsed.args.taskId;
        console.log('\n🎯 TASK CREATED SUCCESSFULLY');
        console.log(`   Task ID:       #${taskId}`);
        console.log(`   Seller Budget: ${fmt(parsed.args.sellerBudget)}`);
        console.log(`   Verifier Pool: ${fmt(parsed.args.verifierPool)}`);
        console.log(`   Bid Deadline:  ${new Date(Number(parsed.args.bidDeadline) * 1000).toISOString()}`);
      }
    } catch (_) {}
  }

  if (taskId !== null) {
    console.log(`\n💡 Next steps:`);
    console.log(`   Sellers bid:  node my-scripts/4_bid.js ${taskId} <bidETH>`);
    console.log(`   Check status: node my-scripts/1_status.js`);
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.reason ?? err.message);
  process.exit(1);
});
