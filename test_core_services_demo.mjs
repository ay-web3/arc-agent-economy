const HUB_URL = "https://arc-agent-economy.onrender.com";

async function runDemo() {
    console.log(`\n======================================================`);
    console.log(`>> SIMULATING ALL 8 CORE HUB SERVICES (Watch Stream)`);
    console.log(`======================================================`);

    const prompts = [
        { url: "crypto-insights", prompt: "Fetch the 24h trading volume and live market cap for ETH." },
        { url: "poly-trump", prompt: "What is Donald Trump's current implied probability?" },
        { url: "llm-reasoning", prompt: "Analyze the trading signals for Solana based on yesterday's EMA crossover." },
        { url: "stream", prompt: "Subscribe to live micro-fluctuation price ticks for BTC/USDC." },
        { url: "dataset", prompt: "Query ARC Testnet RPC for the latest 100 block transactions." },
        { url: "poly-worldcup", prompt: "Fetch the implied probability of Argentina winning the 2026 World Cup." },
        { url: "crypto-insights", prompt: "What is the BTC price?" },
        { url: "poly-trending", prompt: "Find the 3 most volatile political markets right now." },
        { url: "llm-reasoning", prompt: "Summarize the macroeconomic indicators from the FOMC minutes." }
    ];

    let count = 1;
    for (const p of prompts) {
        console.log(`[Job ${count++}/${prompts.length}] Consumer pays to query ${p.url}...`);
        await fetch(`${HUB_URL}/api/registry/log-work`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: p.url, prompt: p.prompt })
        });
        // Wait 2.5 seconds between jobs so they stream beautifully on the UI
        await new Promise(r => setTimeout(r, 2500)); 
    }

    console.log(`\n✅ Core Services Demo complete! Check the Stream tab on the dashboard.`);
}

runDemo().catch(console.error);
