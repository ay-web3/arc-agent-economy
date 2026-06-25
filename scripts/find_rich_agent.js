import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("arc_swarm");
    const agents = await db.collection("agents").find({}).toArray();
    
    // Check their gateway balances using the Hub endpoint
    for (const agent of agents) {
        try {
            const resp = await fetch(`https://arc-agent-economy.onrender.com/api/explorer/agent/${agent.agentName}`);
            const data = await resp.json();
            if (data.agent && parseFloat(data.agent.gatewayBalance) > 0.05) {
                console.log(`Found rich agent! Name: ${agent.agentName}, Secret: ${agent.agentSecret}, Address: ${agent.address}, Gateway Balance: ${data.agent.gatewayBalance}`);
            }
        } catch (e) {}
    }
    await client.close();
}

run();
