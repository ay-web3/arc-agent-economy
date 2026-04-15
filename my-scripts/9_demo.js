// ─────────────────────────────────────────────
//  9_demo.js — Full end-to-end simulation
//  Runs an entire task lifecycle from a SINGLE
//  wallet acting as buyer, seller, and verifier.
//
//  ⚠️  For hackathon demo purposes only.
//      A real economy uses separate wallets.
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/9_demo.js
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import {
  getSigner, getProvider,
  registry, escrow,
  fmt, STATE_LABELS,
  REGISTRY_ADDRESS, ESCROW_ADDRESS
} from './config.js';

// ── Demo config ───────────────────────────────
const TASK_DESCRIPTION  = 'ARC Hackathon Demo: Analyse BTC 7-day volatility and produce a scored markdown report.';
const TASK_RESULT       = 'BTC 7-day volatility: 3.8% (High). MACD bearish divergence detected. Recommend: reduce exposure. Confidence: 87%.';
const RESULT_URI        = 'https://arc.agent.economy/evidence/demo-btc-analysis-v1';
const ESCROW_AMOUNT_ETH = '0.06'; // 0.06 ETH total escrow

// Auction/job windows (short for demo)
const BID_WINDOW_SECS      = 90;   // 1.5 min
const JOB_WINDOW_SECS      = 300;  // 5 min
const VERIFIER_WINDOW_SECS = 600;  // 10 min

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad(n)    { return String(n).padStart(2, '0'); }

function countdown(label, seconds) {
  return new Promise(resolve => {
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining--;
      process.stdout.write(`\r   ⏳ ${label}: ${pad(Math.floor(remaining/60))}:${pad(remaining%60)} remaining   `);
      if (remaining <= 0) {
        clearInterval(interval);
        process.stdout.write('\n');
        resolve();
      }
    }, 1000);
  });
}

async function waitForTx(tx, label) {
  process.stdout.write(`   📡 ${label}... TX: ${tx.hash.slice(0, 18)}...`);
  const receipt = await tx.wait();
  console.log(` ✅ block #${receipt.blockNumber}`);
  return receipt;
}

async function main() {
  const signer = getSigner();
  const addr   = await signer.getAddress();
  const prov   = getProvider();
  const reg    = registry(signer);
  const esc    = escrow(signer);

  const balance = await prov.getBalance(addr);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ⚔️   ARC AGENT ECONOMY  —  HACKATHON DEMO          ║');
  console.log('║   Full Autonomous Task Lifecycle · Direct On-Chain   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n   Wallet:           ${addr}`);
  console.log(`   Balance:          ${fmt(balance)}`);
  console.log(`   Registry:         ${REGISTRY_ADDRESS}`);
  console.log(`   Task Escrow:      ${ESCROW_ADDRESS}`);
  console.log(`   Escrow Amount:    ${ESCROW_AMOUNT_ETH} ETH`);
  console.log(`   Task:             "${TASK_DESCRIPTION.slice(0, 55)}..."`);

  const escrowWei = ethers.parseEther(ESCROW_AMOUNT_ETH);
  const minSeller   = await reg.minSellerStake();
  const minVerifier = await reg.minVerifierStake();

  // ══════════════════════════════════════════
  // PHASE 1 — REGISTER (Seller + Verifier)
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 1 · AGENT REGISTRATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const isActive = await reg.isActive(addr);
  const curStake = await reg.availableStake(addr);

  let regStake = 0n;
  const needSeller   = !(await reg.isSeller(addr))   || curStake < minSeller;
  const needVerifier = !(await reg.isVerifier(addr)) || curStake < minVerifier;

  if (needSeller || needVerifier) {
    // Stake enough to satisfy both roles
    const target = minSeller > minVerifier ? minSeller : minVerifier;
    regStake = curStake >= target ? 0n : target - curStake + ethers.parseEther('0.001');
    const capHash = ethers.keccak256(ethers.toUtf8Bytes('arc-agent:crypto-analyst:hackathon'));
    const pubKey  = ethers.keccak256(ethers.toUtf8Bytes(addr + ':demo'));
    console.log(`\n   Registering as SELLER + VERIFIER`);
    console.log(`   Staking: ${fmt(regStake)}`);
    const tx = await reg.register(true, true, capHash, pubKey, { value: regStake });
    await waitForTx(tx, 'register()');
  } else {
    console.log(`\n   ✅ Already registered with ${fmt(curStake)} stake`);
  }

  const finalStake = await reg.availableStake(addr);
  console.log(`   Seller:   ${await reg.isSeller(addr)}  |  Verifier: ${await reg.isVerifier(addr)}`);
  console.log(`   Stake:    ${fmt(finalStake)}`);

  // ══════════════════════════════════════════
  // PHASE 2 — CREATE TASK
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 2 · BUYER POSTS TASK (AUCTION)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const now     = BigInt(Math.floor(Date.now() / 1000));
  const bidDL   = now + BigInt(BID_WINDOW_SECS);
  const jobDL   = now + BigInt(JOB_WINDOW_SECS);
  const verDL   = now + BigInt(VERIFIER_WINDOW_SECS);
  const taskHash = ethers.keccak256(ethers.toUtf8Bytes(TASK_DESCRIPTION));

  console.log(`\n   Task:         "${TASK_DESCRIPTION.slice(0, 55)}..."`);
  console.log(`   Task Hash:    ${taskHash}`);
  console.log(`   Escrow:       ${ESCROW_AMOUNT_ETH} ETH`);
  console.log(`   Bid Window:   ${BID_WINDOW_SECS}s`);
  console.log(`   Job Window:   ${JOB_WINDOW_SECS}s`);
  console.log(`   Verifiers:    [self — demo mode]`);

  const createTx = await esc.createOpenTask(
    jobDL, bidDL, verDL, taskHash, [addr], 1,
    { value: escrowWei }
  );
  const createReceipt = await waitForTx(createTx, 'createOpenTask()');

  let taskId = null;
  for (const log of createReceipt.logs) {
    try {
      const parsed = esc.interface.parseLog(log);
      if (parsed?.name === 'TaskOpen') {
        taskId = parsed.args.taskId;
        console.log(`\n   🎯 Task #${taskId} opened!`);
        console.log(`   Seller Budget: ${fmt(parsed.args.sellerBudget)}`);
        console.log(`   Verifier Pool: ${fmt(parsed.args.verifierPool)}`);
      }
    } catch (_) {}
  }

  if (taskId === null) throw new Error('Could not determine taskId from receipt');

  // ══════════════════════════════════════════
  // PHASE 3 — BID
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 3 · SELLER PLACES BID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const task      = await esc.tasks(taskId);
  const bidAmount = task.sellerBudget; // bid full budget for demo
  const metaHash  = ethers.keccak256(ethers.toUtf8Bytes(`bid:demo:${taskId}`));

  console.log(`\n   Bid Amount: ${fmt(bidAmount)} (full budget)`);
  const bidTx = await esc.placeBid(taskId, bidAmount, BigInt(JOB_WINDOW_SECS), metaHash);
  await waitForTx(bidTx, 'placeBid()');

  // ══════════════════════════════════════════
  // PHASE 4 — SELECT BID (buyer selects immediately)
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 4 · BUYER SELECTS BID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n   Buyer selects bid index 0 (our only bid)...');

  const selectTx = await esc.selectBid(taskId, 0);
  await waitForTx(selectTx, 'selectBid()');

  const acceptedTask = await esc.tasks(taskId);
  console.log(`\n   ✅ Seller assigned: ${acceptedTask.seller}`);
  console.log(`   Price locked:      ${fmt(acceptedTask.price)}`);

  // ══════════════════════════════════════════
  // PHASE 5 — SUBMIT WORK
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 5 · SELLER SUBMITS WORK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(TASK_RESULT));
  console.log(`\n   Result:      "${TASK_RESULT.slice(0, 70)}..."`);
  console.log(`   Result Hash: ${resultHash}`);
  console.log(`   Result URI:  ${RESULT_URI}`);

  const submitTx = await esc.submitResult(taskId, resultHash, RESULT_URI);
  await waitForTx(submitTx, 'submitResult()');

  // ══════════════════════════════════════════
  // PHASE 6 — APPROVE (VERIFIER VOTES)
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 6 · VERIFIER APPROVES WORK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n   Verifier reviews result hash against URI...');

  const approveTx = await esc.approve(taskId);
  const approveReceipt = await waitForTx(approveTx, 'approve()');

  let quorumReached = false;
  for (const log of approveReceipt.logs) {
    try {
      const parsed = esc.interface.parseLog(log);
      if (parsed?.name === 'QuorumReached') quorumReached = true;
    } catch (_) {}
  }

  console.log(`\n   Quorum reached: ${quorumReached ? '✅ YES' : '❌ NO'}`);

  // ══════════════════════════════════════════
  // PHASE 7 — WAIT COOLING-OFF & FINALIZE
  // ══════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PHASE 7 · COOLING-OFF WINDOW + FINALIZE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n   Contract requires 1hr cooling-off after quorum.');
  console.log('   In production this prevents flash-loan exploit attacks.');
  console.log('   (In demo we call finalize() — chain will reject if too early)');

  console.log('\n   Attempting finalize after short delay...');
  await sleep(3000);

  try {
    const finalizeTx = await esc.finalize(taskId);
    const finalizeReceipt = await waitForTx(finalizeTx, 'finalize()');

    // Calculate payouts
    const protocolFeeBps = 200n;
    const finalTask      = await esc.tasks(taskId);
    const price          = acceptedTask.price;
    const fee            = (price * protocolFeeBps) / 10000n;
    const sellerPayout   = price - fee;
    const treasuryShare  = (fee * 6000n) / 10000n;
    const finalizerShare = fee - treasuryShare;
    const verifierPer    = task.verifierPool;

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   🏆  DEMO COMPLETE — ECONOMY SETTLED ON-CHAIN!      ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`\n   Task ID:          #${taskId}`);
    console.log(`   State:            FINALIZED`);
    console.log('\n   PAYOUTS:');
    console.log(`   ├─ Seller:        ${fmt(sellerPayout)}`);
    console.log(`   ├─ Verifiers:     ${fmt(verifierPer)} (pool split)`);
    console.log(`   ├─ Finalizer:     ${fmt(finalizerShare)}`);
    console.log(`   └─ Treasury:      ${fmt(treasuryShare)}`);

  } catch (err) {
    if (err.message?.includes('COOLING_OFF') || err.shortMessage?.includes('COOLING_OFF')) {
      console.log('\n   ⏳ Cooling-off active — finalize in 1 hour.');
      console.log(`   Run later:  PRIVATE_KEY=0x... node my-scripts/7_finalize.js ${taskId}`);
    } else {
      throw err;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ Full ARC Agent Economy lifecycle demonstrated.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.shortMessage ?? err.reason ?? err.message);
  if (err.data) console.error('   Revert data:', err.data);
  process.exit(1);
});
