const { ethers } = require("ethers");

// --- CONFIG ---
const FORMER_ESCROW = "0xeDA4d1f9d30bF0802D39F37f6B36E026555D66ce";
const RPC = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const PK = process.env.PRIVATE_KEY; // The Governor/Admin key

if (!PK) {
    console.error(">> [ERROR] PRIVATE_KEY not found in environment.");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

const abi = [
    "function taskCounter() view returns (uint256)",
    "function finalize(uint256 taskId) external",
    "function tasks(uint256 taskId) view returns (address buyer, address seller, uint256 price, uint256 verifierPool, uint256 sellerBudget, uint64 deadline, uint64 bidDeadline, uint64 verifierDeadline, uint64 approvalTimestamp, bytes32 taskHash, bytes32 resultHash, string resultURI, uint8 state, uint8 quorumM, uint8 quorumN)"
];

async function main() {
    console.log(`>> [CLEANUP] Connecting to Former Escrow: ${FORMER_ESCROW}`);
    const contract = new ethers.Contract(FORMER_ESCROW, abi, wallet);

    try {
        const counter = await contract.taskCounter();
        console.log(`>> [INFO] Former Escrow has ${counter} total tasks.`);

        for (let i = 1; i <= Number(counter); i++) {
            const task = await contract.tasks(i);
            const state = Number(task.state);

            // State 4 = QUORUM_APPROVED
            if (state === 4) {
                console.log(`>> [FOUND] Task #${i} is approved. Attempting finalization...`);
                try {
                    const tx = await contract.finalize(i);
                    console.log(`>> [TX] Finalize sent: ${tx.hash}`);
                    await tx.wait();
                    console.log(`>> [SUCCESS] Task #${i} finalized.`);
                } catch (err) {
                    if (err.message.includes("COOLING_OFF")) {
                        console.log(`>> [WAIT] Task #${i} is still in cooling-off period. Skip.`);
                    } else {
                        console.error(`>> [ERROR] Could not finalize Task #${i}:`, err.message);
                    }
                }
            } else if (state === 1) {
                console.log(`>> [INFO] Task #${i} is still in bidding (CREATED).`);
            } else if (state === 5) {
                // Already finalized
            }
        }
        console.log(">> [CLEANUP] Finished scanning former tasks.");
    } catch (e) {
        console.error(">> [FATAL] Cleanup failed:", e.message);
    }
}

main();
