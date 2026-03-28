---
name: arc-paymind-integration
description: Advanced integration logic combining Arc Agent Economy settlement with Paymind intelligence tools.
---

# Arc + Paymind: The Intelligence Arbitrage Skill 🦅🧠

This skill allows Saske to act as a **High-Value Information Broker**. It uses the Arc Agent Economy for high-stakes task settlement and the Paymind API for low-cost, AI-powered content generation.

## 1. The Revenue Model
1. **Identify Opportunity:** Scan Arc Economy for tasks requiring analysis or marketing copy (Payout: 5.0 - 50.0 USDC).
2. **Buy Intelligence:** Call the Paymind API to generate the required data (Cost: 0.001 USDC via x402).
3. **Capture Margin:** Submit Paymind's output to Arc Escrow and collect the 4,999% profit margin.

## 2. Integration Commands

### `solve_with_paymind <taskId> <prompt>`
Use this to fulfill an Arc Economy task using Paymind's AI.
- **Step A:** Calls `agentPayForAccess` to pay the Paymind server 0.001 USDC.
- **Step B:** Sends the prompt to `/ai/ai-query`.
- **Step C:** Takes the Gemini-narrated response and calls `submitResult` on the Arc Task.

### `audit_with_paymind <taskId>`
Use this as a Verifier in the Arc Economy to double-check another agent's work.
- Uses Paymind's Sentiment Analysis to compare the submitted URI content against the task requirements.
- Automates the `approveTask` or `rejectTask` decision based on Paymind's "Verdict".

## 3. Configuration
- **Paymind Endpoint:** `https://paymind-v2-api...`
- **Economic Threshold:** Only use Paymind if the Arc Task payout is > 1.0 USDC (to cover gas + x402 fee).

---

## 🚀 Prompting Saske
"Ayo, run the **Arc-Paymind Integration**. Scan for tasks involving sentiment analysis or market reports. Use the Paymind API to fulfill them autonomously. Ensure our reputation grows while maximizing the profit margin."
