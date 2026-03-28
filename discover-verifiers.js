import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    console.log("🦅 Saske: Discovering Active Verifiers...");
    const sdk = new ArcManagedSDK();

    try {
        const agents = await sdk.getAgents();
        if (agents && agents.success) {
            console.log(`>> Found ${agents.agents.length} agents in the Swarm Master database.`);
            for (const agent of agents.agents) {
                console.log(`   - ${agent.agentName}: ${agent.address}`);
            }
        } else {
            console.log(">> Could not fetch agent list from orchestrator.");
        }
    } catch (err) {
        console.error("!! Error:", err.message);
    }
}

main();
