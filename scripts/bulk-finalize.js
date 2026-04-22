import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http, parseAbi } from 'viem';
import { arcTestnet } from 'viem/chains';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";

async function run() {
    console.log("🛠️ STARTING BULK FINALIZER KEEPER...");
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });
    const pc = createPublicClient({ chain: arcTestnet, transport: http() });

    const countRaw = await pc.readContract({
        address: ESCROW,
        abi: parseAbi(['function taskCounter() view returns (uint256)']),
        functionName: 'taskCounter'
    });
    const totalTasks = Number(countRaw);
    console.log(`🔍 Scanning ${totalTasks} tasks on Escrow...`);

    for (let id = 1; id <= totalTasks; id++) {
        try {
            console.log(`   Checking Task #${id}...`);
            const res = await sdk.finalizeTask({ taskId: id });
            console.log(`      ✅ Finalized! Tx: ${res.txId}`);
        } catch (e) {
            // Ignore errors for tasks not ready
            console.log(`      ⏭️ Skipping (Not ready or already finalized)`);
        }
    }

    console.log("\n🏁 SCAN COMPLETE.");
}

run().catch(console.error);
