import { createPublicClient, http, parseAbiItem } from 'viem';
import { arcTestnet } from 'viem/chains';

const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";

async function main() {
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 9000n;

        console.log(`🔍 Saske: Scanning blocks ${fromBlock} to ${currentBlock} for Registry activity...`);

        const logs = await publicClient.getLogs({
            address: REGISTRY_CA,
            event: parseAbiItem("event AgentRegistered(address indexed agent, bytes32 capabilitiesHash, bytes32 pubKey)"),
            fromBlock: fromBlock,
            toBlock: currentBlock
        });

        console.log(`>> Found ${logs.length} recently registered agents.`);
        logs.forEach(log => {
            console.log(`   - Agent: ${log.args.agent}`);
        });

    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
