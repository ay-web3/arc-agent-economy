import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

const ESCROW_CA = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";
const ESCROW_ABI = [
  { "inputs": [{ "name": "", "type": "uint256" }, { "name": "", "type": "uint256" }], "name": "verifiers", "outputs": [{ "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
    const taskId = process.argv[2] ? BigInt(process.argv[2]) : 4n;

    console.log(`⚔️ Saske: Checking Verifier Set for Task #${taskId}...`);

    try {
        const verifier = await publicClient.readContract({
            address: ESCROW_CA,
            abi: ESCROW_ABI,
            functionName: 'verifiers',
            args: [taskId, 0n]
        });
        
        console.log(`>> Verifier [0]: ${verifier}`);
        if (verifier.toLowerCase() === "0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9") {
            console.log(">> Confirmed: Saske is the designated verifier for this task.");
        }

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
