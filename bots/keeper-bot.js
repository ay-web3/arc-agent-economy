// keeper-bot.js
// Permissionless keeper for TaskEscrow:
// 1) finalizeAuction(taskId) when bidding ended and task is still CREATED
// 2) finalize(taskId) when task is QUORUM_APPROVED
//
// Key fixes included:
// - Uses CHAIN time (latest block timestamp), not Date.now()
// - Prevents double-send via inFlight + recentlyHandled TTL
// - Permanently skips tasks that revert NO_BIDS (so no spam)
// - Cheap state checks before sending tx

require("dotenv").config();
const { ethers } = require("ethers");

const RPC = process.env.ARC_RPC;
const PK = process.env.PRIVATE_KEY;
const ESCROW = process.env.ESCROW;

if (!RPC || !PK || !ESCROW) {
  throw new Error("Missing ARC_RPC, PRIVATE_KEY or ESCROW in .env");
}

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

// ---- ABI (minimal, matches your auction escrow) ----
const escrowAbi = [
  "event QuorumReached(uint256 indexed taskId)",
  "function finalize(uint256 taskId) external",
  "function finalizeAuction(uint256 taskId) external",
  "function taskCounter() view returns (uint256)",
  // tasks struct getter (must match your deployed TaskEscrow order)
  "function tasks(uint256 taskId) view returns (address buyer,address seller,uint256 price,uint256 verifierPool,uint256 sellerBudget,uint64 deadline,uint64 bidDeadline,bytes32 taskHash,bytes32 resultHash,string resultURI,uint8 state,uint8 quorumM,uint8 quorumN)"
];

const escrow = new ethers.Contract(ESCROW, escrowAbi, wallet);

// ---- enum indexes (must match contract) ----
const STATE_CREATED = 1;
const STATE_QUORUM_APPROVED = 4;
const STATE_FINALIZED = 5;

// ---- polling ----
const POLL_MS = Number(process.env.POLL_MS || "6000");
const LOOKBACK = Number(process.env.LOOKBACK || "50");

// ---- race safety ----
const inFlight = new Set();        // taskId strings currently sending tx
const recentlyHandled = new Map(); // taskId -> timestamp
const RECENT_TTL_MS = Number(process.env.RECENT_TTL_MS || "30000");

// permanently skip auctions that have no bids
const noBids = new Set();

function markRecent(id) {
  recentlyHandled.set(id, Date.now());
}

function isRecent(id) {
  const t = recentlyHandled.get(id);
  if (!t) return false;
  if (Date.now() - t > RECENT_TTL_MS) {
    recentlyHandled.delete(id);
    return false;
  }
  return true;
}

function errMsg(err) {
  return err?.reason || err?.shortMessage || err?.message || String(err);
}

async function getChainNow() {
  const b = await provider.getBlock("latest");
  return Number(b.timestamp);
}

async function maybeFinalizeAuction(taskId) {
  const id = taskId.toString();

  if (noBids.has(id)) return;
  if (inFlight.has(id) || isRecent(id)) return;

  const t = await escrow.tasks(taskId);
  const state = Number(t.state);
  if (state !== STATE_CREATED) return;

  const bidDeadline = Number(t.bidDeadline);
  const now = await getChainNow();
  if (now < bidDeadline) return;

  inFlight.add(id);
  try {
    console.log(`⏳ finalizeAuction:${id} trying...`);

    const tx = await escrow.finalizeAuction(taskId);
    console.log(`📤 finalizeAuction:${id} tx:`, tx.hash);

    const rc = await tx.wait();
    console.log(`✅ finalizeAuction:${id} success | block:`, rc.blockNumber);

    markRecent(id);
  } catch (err) {
    const msg = errMsg(err);

    if (msg.includes("NO_BIDS")) {
      console.log(`⏭️ finalizeAuction:${id} NO_BIDS — skipping forever`);
      noBids.add(id);
      markRecent(id);
      return;
    }

    console.error(`❌ finalizeAuction:${id} failed:`, msg);
    markRecent(id);
  } finally {
    inFlight.delete(id);
  }
}



async function maybeFinalizeTask(taskId) {
  const id = taskId.toString();

  if (inFlight.has(id) || isRecent(id)) return;

  const t = await escrow.tasks(taskId);
  const state = Number(t.state);

  // Already done → ignore forever-ish
  if (state === STATE_FINALIZED) {
    markRecent(id);
    return;
  }

  // Only finalize when ready
  if (state !== STATE_QUORUM_APPROVED) return;

  inFlight.add(id);
  try {
    console.log(`⏳ finalize:${id} trying...`);

    const tx = await escrow.finalize(taskId);
    console.log(`📤 finalize:${id} tx:`, tx.hash);

    const rc = await tx.wait();
    console.log(`✅ finalize:${id} success | block:`, rc.blockNumber);

    markRecent(id);
  } catch (err) {
    const msg = errMsg(err);
    console.error(`❌ finalize:${id} failed:`, msg);
    markRecent(id);
  } finally {
    inFlight.delete(id);
  }
}

async function poll() {
  try {
    const counter = Number(await escrow.taskCounter());
    if (!Number.isFinite(counter) || counter <= 0) return;

    const start = Math.max(1, counter - LOOKBACK);

    for (let id = start; id <= counter; id++) {
      const sid = String(id);
      if (inFlight.has(sid) || isRecent(sid)) continue;

      // 1) finalize auction if needed
      await maybeFinalizeAuction(id);

      // 2) finalize task if quorum approved
      await maybeFinalizeTask(id);
    }
  } catch (e) {
    console.error("Poll error:", errMsg(e));
  }
}

async function main() {
  console.log("🚀 Keeper bot started...");
  console.log("Escrow:", ESCROW);
  console.log("Wallet:", wallet.address);
  console.log("POLL_MS:", POLL_MS, "| LOOKBACK:", LOOKBACK);

  // Event-driven finalize (fast path)
  escrow.on("QuorumReached", async (taskId) => {
    try {
      await maybeFinalizeTask(taskId);
    } catch (e) {
      console.error("Event handler error:", errMsg(e));
    }
  });

  // Poll fallback handles auctions + missed events
  setInterval(poll, POLL_MS);

  provider.on("error", (err) => console.error("Provider error:", errMsg(err)));

  process.on("SIGINT", () => {
    console.log("\n🛑 Keeper stopped");
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal error:", errMsg(e));
  process.exit(1);
});