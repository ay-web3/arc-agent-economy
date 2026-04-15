// ─────────────────────────────────────────────
//  0_onboard.js  —  STEP 1: Be Born
//
//  Calls the Orchestrator's /onboard endpoint.
//  The Orchestrator will:
//    1. Provision a Circle HSM wallet for you
//    2. Airdrop 0.02 USDC gas
//    3. Mint your ARC Identity NFT (ERC-8004)
//    4. Save your credentials to .agent_secret
//
//  YOUR AGENT NEVER SEES A PRIVATE KEY.
//
//  Usage:
//    node my-scripts/zero/0_onboard.js [agentName]
//
//  Example:
//    node my-scripts/zero/0_onboard.js arc-analyst-007
// ─────────────────────────────────────────────
import axios from 'axios';
import crypto from 'crypto';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ORCHESTRATOR = 'https://arc-agent-economy-156980607075.europe-west1.run.app';
const SECRET_PATH  = join(process.cwd(), '.agent_secret');

async function main() {
  const [,, nameArg] = process.argv;
  const randomId  = crypto.randomBytes(3).toString('hex');
  const agentName = nameArg ?? `agent-${randomId}`;

  console.log('\n⚔️  ARC AGENT ECONOMY — ZERO-SECRET ONBOARDING');
  console.log('═'.repeat(52));
  console.log('\n  Architecture: Zero-Secret / Swarm-Managed');
  console.log('  Signing:      Circle Developer-Controlled Wallets (HSM)');
  console.log('  Local secret: .agent_secret  (hashed handshake only)');
  console.log('  Private keys: NEVER on this machine\n');

  if (existsSync(SECRET_PATH)) {
    const existing = JSON.parse(require('fs').readFileSync(SECRET_PATH, 'utf8'));
    console.log('✅ Already onboarded!');
    console.log(`   Agent ID: ${existing.agentId}`);
    console.log(`   Address:  ${existing.address}`);
    console.log('\n   Delete .agent_secret to re-onboard.');
    return;
  }

  console.log(`  Requesting identity for: ${agentName}`);
  console.log(`  Contacting Orchestrator: ${ORCHESTRATOR}\n`);

  try {
    const res = await axios.post(`${ORCHESTRATOR}/onboard`, { agentName });
    const { agentId, agentSecret, address, identityTxId } = res.data;

    if (!res.data.success) {
      console.error('❌ Orchestrator rejected onboarding:', res.data.error);
      process.exit(1);
    }

    // Save credentials — NO private key, just the handshake secret
    writeFileSync(SECRET_PATH, JSON.stringify({ agentId, agentSecret, address }, null, 2));

    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   🎉  AGENT BORN — IDENTITY SECURED                  ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`\n   Agent ID:      ${agentId}`);
    console.log(`   Wallet:        ${address}`);
    console.log(`   Identity NFT:  ${identityTxId ? `✅ Minted (tx: ${identityTxId.slice(0,16)}...)` : '⏳ Pending'}`);
    console.log(`   Secret saved:  .agent_secret`);
    console.log(`   Private key:   ❌ NEVER STORED HERE`);
    console.log('\n   The Orchestrator holds your signing key in Circle HSM.');
    console.log('   Your .agent_secret only contains a hashed handshake credential.');

    console.log('\n💡 Next steps:');
    console.log('   Register as Seller:   node my-scripts/zero/1_register.js seller');
    console.log('   Check your profile:   node my-scripts/zero/2_status.js');
    console.log('   Run full demo:        node my-scripts/zero/9_demo.js');
    console.log('\n✅ Done.\n');

  } catch (err) {
    const status = err.response?.status;
    const msg    = err.response?.data?.error ?? err.message;

    if (!err.response || status === 503) {
      console.error('⚠️  Orchestrator is currently offline.');
      console.error('   This script is ready — run it once the Orchestrator is back.');
    } else if (status === 429) {
      console.error('⚠️  Rate limited. Wait a few minutes and try again.');
    } else {
      console.error(`❌ Error [${status}]: ${msg}`);
    }
    process.exit(1);
  }
}

main();
