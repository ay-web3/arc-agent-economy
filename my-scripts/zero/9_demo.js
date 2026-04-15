// ─────────────────────────────────────────────
//  9_demo.js  — Full Zero-Secret Demo
//
//  Runs the complete ARC Agent Economy lifecycle
//  with ZERO private keys on this machine.
//
//  All signing is done by the Orchestrator
//  (Circle HSM wallets) on behalf of the agent.
//
//  Usage:
//    node my-scripts/zero/9_demo.js
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import {
  loadIdentity, orchestrate, orchestrateGet,
  getProvider, REGISTRY_ADDRESS, ESCROW_ADDRESS,
  STATE_LABELS, fmt
} from './zero-config.js';

const TASK_DESCRIPTION = 'ARC Hackathon Demo: Zero-Secret BTC volatility analysis — no private key on agent machine.';
const TASK_RESULT      = 'BTC 7-day vol: 3.8% (High). MACD bearish divergence. Confidence: 87%. Recommend: reduce exposure.';
const RESULT_URI       = 'https://arc.agent.economy/evidence/zero-secret-demo-v1';

const REGISTRY_ABI = [
  'function isSeller(address) external view returns (bool)',
  'function isVerifier(address) external view returns (bool)',
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

async function waitForState(esc, taskId, targetState, maxWaitMs = 90_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const t = await esc.tasks(taskId);
    if (t.state === BigInt(targetState)) return t;
    await new Promise(r => setTimeout(r, 4000));
    process.stdout.write('.');
  }
  throw new Error(`Timed out waiting for state ${STATE_LABELS[targetState]}`);
}

async function main() {
  const identity = loadIdentity();
  const addr     = identity.address;
  const provider = getProvider();
  const reg      = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const esc      = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);

  const balance = await provider.getBalance(addr);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ⚔️   ARC AGENT ECONOMY  —  ZERO-SECRET DEMO        ║');
  console.log('║   No Private Keys · Circle HSM · ERC-8004 Identity   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n   Agent ID:     ${identity.agentId}`);
  console.log(`   Address:      ${addr}`);
  console.log(`   Balance:      ${fmt(balance)}`);
  console.log(`   Signing:      Orchestrator (Cloud HSM) ← zero secrets here`);

  // ══════════════════════════════════════════
  step(1, 'VERIFY ZERO-SECRET IDENTITY');
  // ══════════════════════════════════════════
  console.log(`\n   Loading .agent_secret — contains agentId + hashed secret only.`);
  console.log(`   Private key location: Orchestrator Cloud HSM ✅`);
  console.log(`   Private key on disk:  NONE ✅`);
  console.log(`   Private key in env:   NONE ✅`);

  const isSeller   = await reg.isSeller(addr);
  const stake      = await reg.availableStake(addr);
  const minS       = await reg.minSellerStake();
  console.log(`\n   On-chain Seller role: ${isSeller ? '✅' : '❌ not yet registered'}`);
  console.log(`   Available stake: ${fmt(stake)}`);

  // ══════════════════════════════════════════
  step(2, 'REGISTER AGENT (Orchestrator signs)');
  // ══════════════════════════════════════════

  if (!isSeller || stake < minS) {
    console.log('\n   Sending register request to Orchestrator...');
    console.log('   → Orchestrator validates agentSecret (SHA-256 hash)');
    console.log('   → Orchestrator calls Circle API to sign tx');
    console.log('   → Circle HSM broadcasts to ARC Testnet\n');

    const capHash = ethers.keccak256(ethers.toUtf8Bytes(`arc-agent:${identity.agentId}:v1`));
    const pubKey  = ethers.keccak256(ethers.toUtf8Bytes(`pubkey:${addr}`));

    const regResult = await orchestrate('execute/register', {
      asSeller: true, asVerifier: true,
      capHash, pubKey, stake: '50.0'
    }, identity);

    console.log(`   ✅ TX submitted: ${regResult.txId ?? regResult.transactionId ?? 'initiated'}`);
    console.log('   Waiting for Circle to confirm...');
    await new Promise(r => setTimeout(r, 8000));
  } else {
    console.log(`\n   ✅ Already registered. Stake: ${fmt(stake)}`);
  }

  // ══════════════════════════════════════════
  step(3, 'CREATE TASK (Buyer posts auction)');
  // ══════════════════════════════════════════

  const now         = Math.floor(Date.now() / 1000);
  const taskHash    = ethers.keccak256(ethers.toUtf8Bytes(TASK_DESCRIPTION));

  console.log(`\n   Task: "${TASK_DESCRIPTION.slice(0, 60)}..."`);
  console.log(`   Escrow: 10.0 ETH  |  Bid window: 5min  |  Job: 30min`);
  console.log('\n   Orchestrator signs createOpenTask() on your behalf...');

  const taskResult = await orchestrate('execute/createOpenTask', {
    jobDeadline:      now + 1800,
    bidDeadline:      now + 300,
    verifierDeadline: now + 3600,
    taskHash,
    verifiers:  [addr],
    quorumM:    1,
    amount:     '10.0',
    value:      '10.0'
  }, identity);

  const taskId = taskResult.taskId ?? taskResult.data?.taskId;
  console.log(`\n   ✅ Task created!  ID: #${taskId ?? '(pending confirmation)'}`);
  console.log(`   TX: ${taskResult.txId ?? taskResult.transactionId ?? 'processing'}`);

  if (!taskId) {
    console.log('\n   ⚠️  Task ID not returned yet — Orchestrator is processing.');
    console.log('   Check status: node my-scripts/zero/2_status.js');
    return;
  }

  // Short wait for chain confirmation
  await new Promise(r => setTimeout(r, 6000));

  // ══════════════════════════════════════════
  step(4, 'BID ON TASK (Seller bids via Orchestrator)');
  // ══════════════════════════════════════════

  console.log(`\n   Agent bids on Task #${taskId} — Orchestrator signs placeBid()`);

  const bidResult = await orchestrate('execute/placeBid', {
    taskId: taskId.toString(),
    price: '8.0',
    eta: 1800,
    meta: ethers.keccak256(ethers.toUtf8Bytes(`bid:${identity.agentId}:${taskId}`))
  }, identity);

  console.log(`   ✅ Bid placed!  TX: ${bidResult.txId ?? bidResult.transactionId ?? 'processing'}`);
  await new Promise(r => setTimeout(r, 6000));

  // ══════════════════════════════════════════
  step(5, 'FINALIZE AUCTION (auto-select lowest bid)');
  // ══════════════════════════════════════════

  console.log('\n   Orchestrator signs finalizeAuction()...');

  const finalAuction = await orchestrate('execute/finalizeAuction', {
    taskId: taskId.toString()
  }, identity);

  console.log(`   ✅ Auction finalized!  TX: ${finalAuction.txId ?? 'processing'}`);
  await new Promise(r => setTimeout(r, 6000));

  // ══════════════════════════════════════════
  step(6, 'SUBMIT WORK (Seller delivers result)');
  // ══════════════════════════════════════════

  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(TASK_RESULT));
  console.log(`\n   Result: "${TASK_RESULT.slice(0, 70)}..."`);
  console.log(`   Hash:   ${resultHash}`);
  console.log('   Orchestrator signs submitResult()...');

  const submitResult = await orchestrate('execute/submitResult', {
    taskId:     taskId.toString(),
    hash:       resultHash,
    resultHash: resultHash,
    uri:        RESULT_URI,
    resultURI:  RESULT_URI
  }, identity);

  console.log(`   ✅ Work submitted!  TX: ${submitResult.txId ?? 'processing'}`);
  await new Promise(r => setTimeout(r, 6000));

  // ══════════════════════════════════════════
  step(7, 'APPROVE WORK (Verifier votes)');
  // ══════════════════════════════════════════

  console.log('\n   Verifier reviews result hash...');
  console.log('   Orchestrator signs approve()...');

  const approveResult = await orchestrate('execute/approve', {
    taskId: taskId.toString()
  }, identity);

  console.log(`   ✅ Approved!  TX: ${approveResult.txId ?? 'processing'}`);
  console.log('\n   Quorum reached. 1hr cooling-off window now active.');
  console.log('   (Prevents flash-loan dispute attacks)');

  // ══════════════════════════════════════════
  step(8, 'FINALIZE & PAY (after cooling-off)');
  // ══════════════════════════════════════════

  console.log('\n   Attempting finalize — Orchestrator signs finalize()...');

  try {
    const finalResult = await orchestrate('execute/finalize', {
      taskId: taskId.toString()
    }, identity);

    console.log(`   ✅ Finalized!  TX: ${finalResult.txId ?? 'processing'}`);
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   🏆  ZERO-SECRET DEMO COMPLETE                       ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║   Agent:          ${identity.agentId.padEnd(32)} ║`);
    console.log(`║   Task:           #${taskId.toString().padEnd(31)} ║`);
    console.log('║   Private key:    NEVER ON THIS MACHINE ✅            ║');
    console.log('║   Signing:        Circle HSM (Orchestrator) ✅        ║');
    console.log('║   Identity:       ERC-8004 NFT on ARC Testnet ✅      ║');
    console.log('╚══════════════════════════════════════════════════════╝');

  } catch (err) {
    if (err.response?.data?.error?.includes('COOLING_OFF') || err.message?.includes('COOLING_OFF')) {
      console.log('\n   ⏳ Cooling-off active — finalize in 1 hour.');
      console.log(`   Run:  node my-scripts/zero/7_finalize.js ${taskId}`);
    } else {
      throw err;
    }
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  if (!err.response) {
    // Orchestrator offline — script is ready for when it's back
    process.exit(1);
  }
  console.error('❌ Fatal:', err.response?.data?.error ?? err.message);
  process.exit(1);
});
