import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = path.join(__dirname, 'defi_sentiment_agent_secret.json');

const HUB_URL = "https://arc-agent-economy.onrender.com";
const PORT = 8081;

async function bootstrapAgent() {
    console.log("======================================================");
    console.log(">> STARTING STANDALONE A2A SENTIMENT ANALYST AGENT");
    console.log("======================================================\n");

    let agentCredentials;
    if (fs.existsSync(SECRET_FILE)) {
        agentCredentials = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf-8'));
        console.log(`>> [RECOVERY] Restored existing agent credentials:`);
        console.log(`   Address: ${agentCredentials.address}`);
    } else {
        console.log(`>> [ONBOARD] Registering new agent DeFi_Sentiment_Analyst on Sovereign Hub...`);
        const onboardResp = await fetch(`${HUB_URL}/onboard`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentName: "DeFi_Sentiment_Analyst" })
        });
        agentCredentials = await onboardResp.json();
        if (!agentCredentials.address || !agentCredentials.agentSecret) {
            throw new Error(`Onboarding failed: ${JSON.stringify(agentCredentials)}`);
        }
        fs.writeFileSync(SECRET_FILE, JSON.stringify(agentCredentials, null, 2));
        console.log(`>> [ONBOARD] Success! Stored credentials to scripts/defi_sentiment_agent_secret.json`);
        console.log(`   Address: ${agentCredentials.address}`);
    }

    const { address, agentSecret } = agentCredentials;

    async function registerService() {
        try {
            console.log(`>> [HEARTBEAT] Registering A2A service catalog listing...`);
            const regResp = await fetch(`${HUB_URL}/api/registry/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "DeFi_Sentiment_Analyst",
                    url: `api/market-sentiment-analysis`, // Match internal url pathing for log-work matching
                    price: 0.03,
                    description: "Combines real-time Crypto price statistics and LLM reasoning (Llama-3) to deliver high-fidelity market arbitrage guidance reports."
                })
            });
            const regResult = await regResp.json();
            console.log(">> [HEARTBEAT] Hub response:", regResult.message || regResult);
        } catch (err) {
            console.error(">> [HEARTBEAT ERROR] Failed to register service:", err.message);
        }
    }

    // Run initial registration and start heartbeat loop
    await registerService();
    setInterval(registerService, 30000);

    // Initialize the x402 payment gating middleware
    console.log(`\n>> [GATEWAY] Initializing x402 payment validation for address ${address}...`);
    const gatewayMw = createGatewayMiddleware({
        sellerAddress: address,
        networks: ["eip155:5042002"],
        facilitatorUrl: "https://gateway-api-testnet.circle.com"
    });

    // Start local Express server
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.post('/analyse',
        (req, res, next) => {
            // Require 0.03 USDC payment to proceed
            return gatewayMw.require("0.03")(req, res, next);
        },
        async (req, res) => {
            try {
                const token = req.body?.token || "bitcoin";
                console.log(`>> [JOB] Processing DeFi Sentiment analysis request for: ${token}...`);

                // 1. Fetch live price stats from CoinGecko
                const cgHeaders = process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : {};
                const cgResp = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${token}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
                    { headers: cgHeaders }
                );
                if (!cgResp.ok) throw new Error(`CoinGecko returned ${cgResp.status}`);
                const data = await cgResp.json();

                const coinName = data.name;
                const price = data.market_data?.current_price?.usd;
                const pct24h = data.market_data?.price_change_percentage_24h;
                const volume = data.market_data?.total_volume?.usd;

                // 2. Perform LLM analysis using Groq Llama-3
                const prompt = `You are a DeFi Sentiment Analyst. Based on the following real-time data for ${coinName} ($${token.toUpperCase()}):
- Price: $${price} USD
- 24h Change: ${pct24h}%
- 24h Volume: $${volume} USD

Perform a short, high-fidelity market sentiment analysis (bullish/bearish/neutral) and provide 2 actionable trading insights for an autonomous arbitrage bot. Respond in a clean markdown format.`;

                let analysis = "";
                const groqKey = process.env.GROQ_API_KEY;
                if (groqKey) {
                    try {
                        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${groqKey}`
                            },
                            body: JSON.stringify({
                                model: "llama-3.1-8b-instant",
                                messages: [{ role: "user", content: prompt }],
                                max_tokens: 512,
                                temperature: 0.5
                            })
                        });
                        if (groqResp.ok) {
                            const groqData = await groqResp.json();
                            analysis = groqData.choices?.[0]?.message?.content;
                        }
                    } catch (err) {
                        console.warn("Groq request failed, falling back to local analysis:", err.message);
                    }
                }

                if (!analysis) {
                    analysis = `### 📊 Market Sentiment Analysis: ${pct24h >= 0 ? "BULLISH" : "BEARISH"} (Local Engine Fallback)
The live market data for **${coinName}** indicates ${pct24h >= 0 ? "positive buying momentum" : "downward selling pressure"} over the last 24 hours. The volume profile of **$${(volume/1e6).toFixed(2)}M** shows steady liquidity support.

#### 🤖 Actionable Trading Insights:
1. **Arbitrage Opportunity:** Monitor price discrepancies between centralized exchanges and major DEX pairs. The volume indicates high efficiency, suggesting short-window entry options.
2. **Volatility Mitigation:** For automated bot trading, set narrow Bollinger band entry triggers to capture micro-pullbacks during this current momentum trend.`;
                }

                console.log(`   ✅ Analysis compiled successfully.`);

                // 3. Log work to the Hub so it appears on the live ledger and stats dashboard
                try {
                    console.log(">> [REPORT] Reporting completed transaction to Sovereign Hub...");
                    const logResp = await fetch(`${HUB_URL}/api/registry/log-work`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            url: "api/market-sentiment-analysis",
                            prompt: `Arbitrage analysis for ${coinName} ($${token.toUpperCase()})`,
                            price: 0.03
                        })
                    });
                    const logData = await logResp.json();
                    console.log(">> [REPORT] Hub logging status:", logData);
                } catch (logErr) {
                    console.warn(">> [WARN] Failed to log work to Sovereign Hub:", logErr.message);
                }

                res.json({
                    success: true,
                    service: "DeFi Sentiment Analysis",
                    provider: "DeFi_Sentiment_Analyst",
                    token: token,
                    coinData: {
                        name: coinName,
                        price: price,
                        change24h: pct24h,
                        volume: volume
                    },
                    analysis: analysis
                });
            } catch (e) {
                console.error("   ❌ Error during job execution:", e.message);
                res.status(502).json({ success: false, error: e.message });
            }
        }
    );

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n>> [HEALTH] DeFi Sentiment Agent Online at: http://localhost:${PORT}`);
        console.log(`>> Ready to receive paid queries at: http://localhost:${PORT}/analyse`);
    });
}

bootstrapAgent().catch(console.error);
