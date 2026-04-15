// ─────────────────────────────────────────────
//  2_register.js  — Register as Seller/Verifier
//  Stakes native ETH and registers on-chain.
//
//  Usage:
//    PRIVATE_KEY=0x... node my-scripts/2_register.js seller  0.05
//    PRIVATE_KEY=0x... node my-scripts/2_register.js verifier 0.03
//    PRIVATE_KEY=0x... node my-scripts/2_register.js both    0.08
// ─────────────────────────────────────────────
import { ethers } from 'ethers';
import { getSigner, registry, fmt, MIN_SELLER_STAKE, MIN_VERIFIER_STAKE } from './config.js';

async function main() {
  const [,, roleArg, stakeEth] = process.argv;

  if (!roleArg || !stakeEth) {
    console.log('Usage:  PRIVATE_KEY=0x... node my-scripts/2_register.js <seller|verifier|both> <stakeInETH>');
    console.log('Example: PRIVATE_KEY=0x... node my-scripts/2_register.js seller 0.05');
    process.exit(1);
  }

  const asSeller   = roleArg === 'seller'   || roleArg === 'both';
  const asVerifier = roleArg === 'verifier' || roleArg === 'both';

  if (!asSeller && !asVerifier) {
    console.error('❌ Role must be: seller, verifier, or both');
    process.exit(1);
  }

  const stakeWei = ethers.parseEther(stakeEth);

  // Sanity checks
  if (asSeller && stakeWei < MIN_SELLER_STAKE) {
    console.warn(`⚠️  Warning: ${stakeEth} ETH is below min seller stake (${fmt(MIN_SELLER_STAKE)})`);
  }
  if (asVerifier && stakeWei < MIN_VERIFIER_STAKE) {
    console.warn(`⚠️  Warning: ${stakeEth} ETH is below min verifier stake (${fmt(MIN_VERIFIER_STAKE)})`);
  }

  const signer = getSigner();
  const reg    = registry(signer);
  const addr   = await signer.getAddress();

  console.log('\n⚔️  ARC AGENT ECONOMY — REGISTER AGENT');
  console.log('═'.repeat(50));
  console.log(`   Address:  ${addr}`);
  console.log(`   Role(s):  ${[asSeller && 'SELLER', asVerifier && 'VERIFIER'].filter(Boolean).join(' + ')}`);
  console.log(`   Stake:    ${fmt(stakeWei)}`);

  // Check existing profile
  const profile = await reg.profile(addr);
  if (profile.active) {
    console.log('\n   ⚡ Agent already registered. Updating roles + topping up stake...');
  }

  // Capabilities hash — encode agent skills as bytes32
  const capHash = ethers.keccak256(ethers.toUtf8Bytes('arc-agent:crypto-analyst:v1'));
  const pubKey  = ethers.keccak256(ethers.toUtf8Bytes(addr + ':pubkey'));

  console.log('\n   📡 Broadcasting registration tx...');
  const tx = await reg.register(asSeller, asVerifier, capHash, pubKey, {
    value: stakeWei
  });

  console.log(`   TX Hash: ${tx.hash}`);
  console.log('   ⏳ Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block #${receipt.blockNumber}`);

  // Read back state
  const newProfile  = await reg.profile(addr);
  const stake       = await reg.stakeOf(addr);
  const isSeller    = await reg.isSeller(addr);
  const isVerifier  = await reg.isVerifier(addr);

  console.log('\n📋 YOUR AGENT PROFILE');
  console.log(`   Active:   ${newProfile.active}`);
  console.log(`   Stake:    ${fmt(stake)}`);
  console.log(`   Seller:   ${isSeller}`);
  console.log(`   Verifier: ${isVerifier}`);
  console.log(`   Cap Hash: ${newProfile.capabilitiesHash}`);
  console.log('\n✅ Registration complete.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.shortMessage ?? err.reason ?? err.message);
  process.exit(1);
});
