import { createPublicClient, http, parseAbi } from 'viem';
import { arcTestnet } from 'viem/chains';
import crypto from 'crypto';

const pc = createPublicClient({ chain: arcTestnet, transport: http() });
const ESCROW = '0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce';
const SELLER = '0x98248a060b716f1e058315cf652df7e754e673e1';
const VERIFIER = '0x8b03f622490c416aed3abe2b772e813ecbead3d3';

async function sim() {
  const jobDeadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const bidDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const verifierDeadline = jobDeadline + 3600n;
  const taskHash = '0x' + crypto.createHash('sha256').update('test').digest('hex');
  const amount = BigInt(1e17); // 0.1 USDC

  try {
    await pc.simulateContract({
      account: SELLER,
      address: ESCROW,
      abi: parseAbi(['function createOpenTask(uint64, uint64, uint64, bytes32, address[], uint8, bool) payable returns (uint256)']),
      functionName: 'createOpenTask',
      args: [jobDeadline, bidDeadline, verifierDeadline, taskHash, [VERIFIER], 1, true],
      value: amount
    });
    console.log('Simulation SUCCESS');
  } catch (e) {
    console.error('Simulation FAILED:', e.message);
  }
}
sim();
