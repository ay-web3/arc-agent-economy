import dotenv from "dotenv";
dotenv.config();
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI);
async function run() {
    await client.connect();
    const db = client.db("arc_swarm");
    await db.collection("agents").updateOne(
        { agentName: "DemoAgent" },
        { $set: {
            agentName: "DemoAgent",
            walletId: process.env.MASTER_WALLET_ID,
            address: process.env.CIRCLE_GATEWAY_ADDRESS || "0x0000000000000000000000000000000000000000"
        }},
        { upsert: true }
    );
    console.log("DemoAgent inserted");
    process.exit(0);
}
run();
