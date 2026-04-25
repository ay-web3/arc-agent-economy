
import { MongoClient } from 'mongodb';
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function checkAgents() {
    await client.connect();
    const db = client.db("arc_swarm");
    const agents = await db.collection("agents").find({ agentName: /Showdown/ }).toArray();
    console.log("=== PERSISTENT AGENTS IN DB ===");
    agents.forEach(a => {
        console.log(`Agent: ${a.agentName}`);
        console.log(`Address: ${a.address}`);
        console.log(`DisplaySecret: ${a.displaySecret || "MISSING"}`);
        console.log(`Hashed: ${a.hashedSecret ? "PRESENT" : "MISSING"}`);
        console.log("----------------------------");
    });
    await client.close();
}
checkAgents();
