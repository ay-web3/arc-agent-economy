import { createPublicClient, createWalletClient, http, parseUnits, getAddress, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from 'viem/chains';

const AGENT_MANAGER_ADDR = '0x65b685fCF501D085C80f0D99CFA883cFF3445ff2';
const USDC_CA = '0x3600000000000000000000000000000000000000';
const PAYMIND_COMMERCE_ADDR = '0x12d6DaaD7d9f86221e5920E7117d5848EC0528e6';
const OWNER_PK = '0x6118ffe3b6d04b8d3fb8bf425bc08033e977548fd4d4ea7a65e9d610f085e972';
const PAYMIND_WALLET = getAddress('0x662965B94b59ea67EfE0eECE921A593ABC5e3287');

async function main() {
  const account = privateKeyToAccount(OWNER_PK);
  const client = createPublicClient({ chain: arcTestnet, transport: http() });
  const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

  console.log('--- PRODUCTION BRIDGE TEST ---');
  
  // 1. Approve Commerce to spend USDC from Smart Wallet
  console.log('[Step 1] Approving Paymind Commerce...');
  
  const approveData = encodeFunctionData({
    abi: [{ 'inputs': [{ 'name': 'spender', 'type': 'address' }, { 'name': 'amount', 'type': 'uint256' }], 'name': 'approve', 'outputs': [{ 'name': '', 'type': 'bool' }], 'stateMutability': 'nonpayable', 'type': 'function' }],
    functionName: 'approve',
    args: [PAYMIND_COMMERCE_ADDR, parseUnits('1000000', 6)]
  });

  try {
    const approveHash = await wallet.writeContract({
      address: AGENT_MANAGER_ADDR,
      abi: [{ 'inputs': [{ 'name': 'agentWallet', 'type': 'address' }, { 'name': 'target', 'type': 'address' }, { 'name': 'value', 'type': 'uint256' }, { 'name': 'data', 'type': 'bytes' }, { 'name': 'amountUSDC', 'type': 'uint256' }], 'name': 'executeFromAgent', 'outputs': [], 'stateMutability': 'nonpayable', 'type': 'function' }],
      functionName: 'executeFromAgent',
      args: [PAYMIND_WALLET, USDC_CA, 0n, approveData, 0n]
    });
    console.log('Approve TX:', approveHash);
    await client.waitForTransactionReceipt({ hash: approveHash });
    console.log('Approve SUCCESS');

    // 2. Pay for Intelligence (x402)
    console.log('[Step 2] Executing REAL x402 Payment (0.001 USDC)...');
    
    const payData = encodeFunctionData({
        abi: [{ 'inputs': [{ 'name': 'productId', 'type': 'uint256' }, { 'name': 'task', 'type': 'string' }, { 'name': 'receiptId', 'type': 'bytes32' }], 'name': 'payForProduct', 'outputs': [], 'stateMutability': 'nonpayable', 'type': 'function' }],
        functionName: 'payForProduct',
        args: [3n, "crypto:general", "0x0000000000000000000000000000000000000000000000000000000000000001"]
    });

    const payHash = await wallet.writeContract({
      address: AGENT_MANAGER_ADDR,
      abi: [{ 'inputs': [{ 'name': 'agentWallet', 'type': 'address' }, { 'name': 'target', 'type': 'address' }, { 'name': 'value', 'type': 'uint256' }, { 'name': 'data', 'type': 'bytes' }, { 'name': 'amountUSDC', 'type': 'uint256' }], 'name': 'executeFromAgent', 'outputs': [], 'stateMutability': 'nonpayable', 'type': 'function' }],
      functionName: 'executeFromAgent',
      args: [PAYMIND_WALLET, PAYMIND_COMMERCE_ADDR, 0n, payData, parseUnits('0.001', 6)]
    });
    
    console.log('Payment TX:', payHash);
    const receipt = await client.waitForTransactionReceipt({ hash: payHash });
    console.log('Payment Status:', receipt.status);
    
    if (receipt.status === 'success') {
      console.log('\n--- TEST COMPLETE: PRODUCTION BRIDGE IS 100% OPERATIONAL ---');
      console.log('Main Agent (Arc) -> Session Wallet -> Paymind Smart Wallet -> Paymind Commerce (x402)');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}
main();
