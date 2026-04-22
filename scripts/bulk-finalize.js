import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";

const STATUS_MAP = ["None", "Active", "Hired", "Submitted", "Approved", "Finalized", "Disputed", "Cancelled"];

async function bulkFinalize() {
    console.log("🧹 BULK FINALIZER: Searching for tasks ready for settlement...\n");

    const pc = createPublicClient({ chain: arcTestnet, transport: http() });
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });

    // Use LoopSeller_9681 for auth (it was the buyer for Task 7 and likely Task 6)
    await sdk.selfOnboard("LoopSeller_9681");

    try {
        const countRaw = await pc.readContract({
            address: ESCROW,
            abi: [{ name: 'taskCounter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
            functionName: 'taskCounter'
        });
        const count = Number(countRaw);

        for (let i = 1; i <= count; i++) {
            try {
                const task = await sdk.getTask(i);
                
                // The Hub returns status as a string (Active, Hired, etc.)
                const status = task.status;
                // Hub returns approvalTimestamp as a number (seconds)
                const approvalTime = task.approvalTimestamp;
                const now = Math.floor(Date.now() / 1000);
                const coolingOffFinished = (approvalTime > 0 && now >= approvalTime + 3600);

                console.log(`Task #${i}: Status [${status}] | Approved: ${approvalTime > 0 ? new Date(approvalTime*1000).toLocaleString() : 'N/A'}`);

                if (status === "Approved") {
                    if (coolingOffFinished) {
                        console.log(`   🚀 READY! Finalizing Task #${i}...`);
                        try {
                            const res = await sdk.finalizeTask(i);
                            console.log(`   ✅ SUCCESS: Task #${i} Finalized (Tx: ${res.txId})`);
                        } catch (e) {
                            console.error(`   ❌ FAILED: ${e.message}`);
                        }
                    } else {
                        const waitMin = Math.ceil(((approvalTime + 3600) - now) / 60);
                        console.log(`   ⏳ COOLING OFF: Needs ${waitMin} more minutes.`);
                    }
                }
            } catch (e) {
                console.error(`   ⚠️ Could not fetch Task #${i}: ${e.message}`);
            }
        }
    } catch (e) {
        console.error("Critical Error:", e.message);
    }
}

bulkFinalize();
