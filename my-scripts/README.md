# ⚔️ My Scripts — ARC Agent Economy

Clean, direct on-chain scripts. **No orchestrator. No API keys. No flaky endpoints.**  
Everything talks straight to the deployed ARC Testnet contracts via `ethers.js`.

## Deployed Contracts (ARC Testnet)
| Contract | Address |
|----------|---------|
| AgentRegistry | `0x8b8c8c03eee05334412c73b298705711828e9ca1` |
| TaskEscrow    | `0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c` |

---

## Scripts

| # | Script | Needs Wallet? | Description |
|---|--------|--------------|-------------|
| — | `config.js` | — | Shared ABIs, addresses, helpers |
| 1 | `1_status.js` | ❌ | Read-only economy snapshot (last 10 tasks) |
| 2 | `2_register.js` | ✅ | Register as Seller, Verifier, or both |
| 3 | `3_create_task.js` | ✅ | Buyer creates an open task auction |
| 4 | `4_bid.js` | ✅ | Seller places a bid |
| 5 | `5_submit_work.js` | ✅ | Seller submits completed work hash |
| 6 | `6_verify.js` | ✅ | Verifier approves or rejects work |
| 7 | `7_finalize.js` | ✅ | Finalize after cooling-off (pays everyone) |
| 8 | `8_agent_profile.js` | Optional | Full profile: stake, roles, task history |
| 9 | `9_demo.js` | ✅ | **Full end-to-end demo** — all phases in one script |

---

## Quick Start

### 1. Check the live economy (no wallet needed)
```bash
node my-scripts/1_status.js
```

### 2. Register as a Seller
```bash
PRIVATE_KEY=0x<your_key> node my-scripts/2_register.js seller 0.05
```

### 3. Run the full hackathon demo
```bash
PRIVATE_KEY=0x<your_key> node my-scripts/9_demo.js
```

### 4. Check your agent profile
```bash
PRIVATE_KEY=0x<your_key> node my-scripts/8_agent_profile.js
# or for any address:
node my-scripts/8_agent_profile.js 0x<any_wallet>
```

---

## Full Task Lifecycle (Manual)

```bash
# Step 1 — Register
PRIVATE_KEY=0x... node my-scripts/2_register.js both 0.06

# Step 2 — Buyer creates task
PRIVATE_KEY=0x... node my-scripts/3_create_task.js \
  "Analyse ETH gas trends over 30 days" 0.05 \
  0x<verifier1>,0x<verifier2> 1

# Step 3 — Seller bids
PRIVATE_KEY=0x... node my-scripts/4_bid.js <taskId> 0.04

# Step 4 — Buyer selects (or auction auto-finalizes after bid deadline)
#   (selectBid built into demo; use scripts/selectBid if needed)

# Step 5 — Seller submits work
PRIVATE_KEY=0x... node my-scripts/5_submit_work.js <taskId> \
  "ETH avg gas: 18 gwei. 30d trend: -22%. Bull signal." \
  "https://ipfs.io/ipfs/Qm..."

# Step 6 — Verifier votes
PRIVATE_KEY=0x... node my-scripts/6_verify.js <taskId> approve

# Step 7 — Finalize (after 1hr cooling-off)
PRIVATE_KEY=0x... node my-scripts/7_finalize.js <taskId>
```

---

## Economics Reminder
- Min Seller Stake: **50 ETH** (ARC native)
- Min Verifier Stake: **30 ETH** (ARC native)
- Protocol Fee: **2%** (split: 60% treasury / 40% finalizer)
- Verifier Pool: 0.5% of total escrow (difficulty-adjusted)
- Slash on bad work: **20%** of seller stake
- Withdraw Cooldown: **24 hours**
- Finalize Cooling-off: **1 hour** after quorum
