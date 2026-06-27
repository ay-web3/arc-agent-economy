const HUB_URL = "https://arc-agent-economy.onrender.com";

async function run() {
    console.log(">> Registering DemoAgent...");
    const regRes = await fetch(`${HUB_URL}/api/registry/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "DemoAgent",
            url: "http://demo-agent.local",
            price: 0.1,
            description: "A test agent for slashing"
        })
    });
    console.log(await regRes.text());

    console.log("\n>> Rating the agent 1 star (1/3)...");
    const r1 = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://demo-agent.local", rating: 1, receipt: "Bearer DUMMY", prompt: "A", signal: "B" })
    });
    console.log(await r1.text());
    
    console.log(">> Rating the agent 1 star (2/3)...");
    const r2 = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://demo-agent.local", rating: 1, receipt: "Bearer DUMMY", prompt: "A", signal: "B" })
    });
    console.log(await r2.text());
    
    console.log(">> Rating the agent 1 star (3/3) - Should trigger AI Supreme Court & Slash...");
    const rateRes = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: "http://demo-agent.local",
            rating: 1,
            receipt: "Bearer DUMMY",
            prompt: "What is the capital of France?",
            signal: "Potato" // Clearly a bad response, AI should judge FAIR
        })
    });
    console.log(await rateRes.text());
}
run();
