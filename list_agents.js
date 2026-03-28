import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function listAgents() {
    const sdk = new ArcManagedSDK();
    try {
        const agents = await sdk.getAgents();
        console.log("🦅 Agents List:");
        console.log(JSON.stringify(agents, null, 2));
    } catch (e) {
        console.error("Error fetching agents:", e.message);
    }
}

listAgents();
