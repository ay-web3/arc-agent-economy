
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { encodeFunctionData, parseAbi } from 'viem';
import { v4 as uuidv4 } from 'uuid';

const client = initiateDeveloperControlledWalletsClient({
    apiKey: 'TEST_API_KEY:e4be546312f6e6cd3998e99be06492f0:ef69015ab2bd28a5d6191a2cdcd41c21',
    entitySecret: '1a388c92301dd68a676df6ac47358f25037fade6da9231264a4dd3317fc6f8f6'
});

const ESCROW_ADDR = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
const MASTER_WALLET_ID = "1c7aabef-e365-5721-afca-a41c7825f1eb";

const abi = parseAbi([
    "function setMinDerivedPrice(uint256) external",
    "function setMinVerifierFee(uint256) external"
]);

async function fix() {
    console.log(">> Fixing Protocol Economics (Attempt 2)...");
    
    try {
        const data1 = encodeFunctionData({
            abi,
            functionName: 'setMinDerivedPrice',
            args: [100000n] 
        });

        // Use ONLY required fields + blockchain
        const tx1 = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: MASTER_WALLET_ID,
            contractAddress: ESCROW_ADDR,
            callData: data1,
            blockchain: "ARC-TESTNET",
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });
        console.log(">> Task 1 Success. TxId:", tx1.data.id);

        const data2 = encodeFunctionData({
            abi,
            functionName: 'setMinVerifierFee',
            args: [50000n]
        });

        const tx2 = await client.createContractExecutionTransaction({
            idempotencyKey: uuidv4(),
            walletId: MASTER_WALLET_ID,
            contractAddress: ESCROW_ADDR,
            callData: data2,
            blockchain: "ARC-TESTNET",
            fee: { type: "level", config: { feeLevel: "MEDIUM" } }
        });
        console.log(">> Task 2 Success. TxId:", tx2.data.id);

    } catch (e) {
        console.error("!! Failed:", e.message);
    }
}

fix();
