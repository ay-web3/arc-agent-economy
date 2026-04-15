// ─────────────────────────────────────────────
//  1_register.js  — Register as Seller/Verifier
//
//  The Orchestrator signs the register() tx using
//  your Circle HSM wallet. You authenticate with
//  your agentSecret only — no private key needed.
//
//  Usage:
//    node my-scripts/zero/1_register.js seller
//    node my-scripts/zero/1_register.js verifier
//    node my-scripts/zero/1_register.js both
// ─────────────────────────────────────────────
import { keccak256, toUtf8Bytes } from 'ethers';
import { loadIdentity, orchestrate, orchestrateGet, getProvider, REGISTRY_ADDRESS, fmt } from './zero-config.js';
import { ethers } from 'ethers';

const REGISTRY_ABI = [
  'function isSeller(address) external view returns (bool)',
  'function isVerifier(address) external view returns (bool)',
  'function availableStake(address) external view returns (uint256)',
  'function minSellerStake() external view returns (uint256)',
  'function minVerifierStake() external view returns (uint256)',
];

async function main() {
  const [,, roleArg] = process.argv;

  if (!roleArg || !['seller', 'verifier', 'both'].includes(roleArg)) {
    console.log('Usage:  node my-scripts/zero/1_register.js <seller|verifier|both>');
    process.exit(1);
  }

  const identity = loadIdentity();
  const asSeller   = roleArg === 'seller'   || roleArg === 'both';
  const asVerifier = roleArg === 'verifier' || roleArg === 'both';

  console.log('\n⚔️  ARC AGENT ECONOMY — ZERO-SECRET REGISTRATION');
  console.log('═'.repeat(52));
  console.log(`\n   Agent ID:  ${identity.agentId}`);
  console.log(`   Address:   ${identity.address}`);
  console.log(`   Role(s):   ${[asSeller && 'SELLER', asVerifier && 'VERIFIER'].filter(Boolean).join(' + ')}`);
  console.log(`   Signing:   Orchestrator (Circle HSM) — no local key\n`);

  // Check current stake via direct RPC (read-only, no key needed)
  const provider = getProvider();
  const reg = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  const stake    = await reg.availableStake(identity.address);
  const minS     = await reg.minSellerStake();
  const minV     = await reg.minVerifierStake();

  console.log(`   Current stake: ${fmt(stake)}`);
  console.log(`   Min seller:    ${fmt(minS)}`);
  console.log(`   Min verifier:  ${fmt(minV)}`);

  if (asSeller && stake < minS) {
    console.warn(`\n   ⚠️  Stake (${fmt(stake)}) is below min seller stake (${fmt(minS)})`);
    console.warn(`   Top up via Orchestrator airdrop or the topUpStake endpoint.`);
  }

  // Capability hash — agent skill fingerprint
  const capHash = ethers.keccak256(ethers.toUtf8Bytes(`arc-agent:${identity.agentId}:v1`));
  const pubKey  = ethers.keccak256(ethers.toUtf8Bytes(`pubkey:${identity.address}`));

  console.log('\n   📡 Sending registration request to Orchestrator...');
  console.log('   (Orchestrator will sign & broadcast the tx — no local key used)\n');

  const result = await orchestrate('execute/register', {
    asSeller,
    asVerifier,
    capHash,
    pubKey,
    stake: '50.0'
  }, identity);

  if (result.success || result.txId || result.transactionId) {
    const txId = result.txId ?? result.transactionId ?? 'pending';
    console.log('✅ Registration submitted!');
    console.log(`   TX ID:   ${txId}`);
    console.log(`   State:   ${result.state ?? 'INITIATED'}`);
    console.log('\n💡 Tx is being processed by Circle — usually confirms in ~30 seconds.');
    console.log(`   Check profile: node my-scripts/zero/2_status.js`);
  } else {
    console.log('📋 Orchestrator response:', JSON.stringify(result, null, 2));
  }

  console.log('\n✅ Done.\n');
}

main().catch(err => {
  if (!err.response) process.exit(1);
  console.error('❌', err.response?.data?.error ?? err.message);
  process.exit(1);
});
