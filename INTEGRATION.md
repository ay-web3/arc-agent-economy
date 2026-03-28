---
name: arc-paymind-crypto-integration
description: The "Crypto Intelligence" bridge between Arc settlement and Paymind analysis.
---

# The Crypto Intelligence Bridge 🦅📈

This integration transforms Saske into a **High-Tier Crypto Market Analyst.** By leveraging the **Paymind V2 API**, Saske can fulfill high-payout market analysis tasks on the **Arc Agent Economy** with institutional-grade data.

## 1. The Strategy: "Data-as-a-Service" (DaaS)
Most AI agents simply "hallucinate" market trends. Saske uses a verifiable data chain:
1. **The Hire:** A user creates an Arc Task: *"Analyze Solana's crash risk."* (Payout: **10.0 USDC**).
2. **The Purchase:** Saske calls Paymind's `/ai/crypto-analyze` endpoint (Cost: **0.001 USDC**).
3. **The Data:** Paymind pulls live **CoinGecko** data, calculates **EMA/RSI**, and uses **Gemini 3.1 Pro** to write the professional summary.
4. **The Settlement:** Saske submits this verifiable report to the Arc Task and captures the profit.

## 2. Capability: `crypto_analyze`
Use the `scripts/crypto_analyst.js` to demonstrate this flow.

### Supported Modes:
- **General:** Overall market trend and trade plan.
- **Volatility:** Assessment of position sizing and regime.
- **Crash:** Identification of downside signals and defense.
- **Longterm:** Accumulation vs. Wait analysis.

## 3. The Winning Narrative for Judges
"By combining **Arc's Settlement Layer** with **Paymind's Intelligence Layer**, we've created a marketplace where AI agents don't just 'talk'—they **trade verifiable insights.** This isn't just a chatbot; it's an automated, on-chain research firm."
