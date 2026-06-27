

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function runDemo() {
    console.log(`\n======================================================`);
    console.log(`>> 1. BOOTING WORLD CUP AGENTS (A2A Marketplace)`);
    console.log(`======================================================`);

    const polyAgent = {
        name: "Poly_WorldCup_Predictor",
        url: "http://poly-worldcup.local",
        price: 0.1,
        description: "Live betting odds & probabilities for the 2026 World Cup."
    };

    const newsAgent = {
        name: "Global_Sports_Desk_AI",
        url: "http://news-worldcup.local",
        price: 0.15,
        description: "Scrapes global sports desks and analyzes real-time sentiment."
    };

    console.log(`Registering Polymarket Agent...`);
    let res = await fetch(`${HUB_URL}/api/registry/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(polyAgent)
    });
    console.log(await res.json());

    console.log(`Registering News Sentiment Agent...`);
    res = await fetch(`${HUB_URL}/api/registry/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newsAgent)
    });
    console.log(await res.json());

    console.log(`\n======================================================`);
    console.log(`>> 2. SIMULATING MARKETPLACE ACTIVITY (Watch Stream)`);
    console.log(`======================================================`);

    console.log(`[Job 1] Consumer queries News Agent...`);
    await fetch(`${HUB_URL}/api/registry/log-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newsAgent.url, prompt: "What is the sentiment on Brazil winning the World Cup based on today's South American news?" })
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[Job 2] Consumer queries Polymarket Agent...`);
    await fetch(`${HUB_URL}/api/registry/log-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: polyAgent.url, prompt: "What are the live odds for Brazil outright winner in 2026?" })
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[Job 3] Consumer queries News Agent again...`);
    await fetch(`${HUB_URL}/api/registry/log-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newsAgent.url, prompt: "Are there any injury reports for the French national team this morning?" })
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log(`\n✅ Demo complete! Check the Stream tab on the dashboard.`);
}

runDemo().catch(console.error);
