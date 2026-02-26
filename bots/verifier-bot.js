// bots/verifier-bot.js
// ✅ Fixes included:
// 1) Gemini prompt includes task intent/description (pulled from RESULT JSON if present, or from local map by taskHash).
// 2) Robust JSON parsing (sanitizes ```json fences + regex fallback).
// 3) Gas strategy (EIP-1559 tips for approve()).
// 4) IPFS/HTTP timeouts (AbortController) + safe retries.

require("dotenv").config();
const { ethers } = require("ethers");
const Ajv = require("ajv");


// -------------------- ENV --------------------
const RPC = process.env.ARC_RPC;
const ESCROW = process.env.ESCROW;
const PK = process.env.VERIFIER_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

if (!RPC || !ESCROW || !PK) throw new Error("Missing ARC_RPC / ESCROW / VERIFIER_KEY");

const POLL_MS = Number(process.env.POLL_MS || "5000");

// Thresholds (18 decimals native)
const SMALL_TASK_PRICE = BigInt(process.env.SMALL_TASK_PRICE || "2000000000000000000"); // 2e18
const BIG_TASK_PRICE = BigInt(process.env.BIG_TASK_PRICE || "10000000000000000000"); // 10e18

const AI_SCORE_THRESHOLD_MED = Number(process.env.AI_SCORE_THRESHOLD_MED || "0.75");
const AI_SCORE_THRESHOLD_BIG = Number(process.env.AI_SCORE_THRESHOLD_BIG || "0.85");

// Gas strategy
const GAS_TIP_MULT = BigInt(process.env.GAS_TIP_MULT || "2"); // 2x priority fee tip
const GAS_CAP_MULT = BigInt(process.env.GAS_CAP_MULT || "2"); // 2x max fee cap

// Fetch timeouts / retries
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || "10000");
const FETCH_RETRIES = Number(process.env.FETCH_RETRIES || "2");

// Optional: local task-intent map by taskHash (hex string) -> description
// Put in .env as JSON if you want, e.g.
// TASK_INTENTS_JSON={"0xabc...":"Generate a weekly report with ...","0xdef...":"Scrape pricing data ..."}
let TASK_INTENTS = {};
try {
  TASK_INTENTS = process.env.TASK_INTENTS_JSON ? JSON.parse(process.env.TASK_INTENTS_JSON) : {};
} catch {
  TASK_INTENTS = {};
}

// -------------------- Provider/Wallet --------------------
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);

// -------------------- ABI (auction-style tasks) --------------------
const abi = [
  "function taskCounter() view returns (uint256)",
  "function approve(uint256 taskId) external",
  "function tasks(uint256 taskId) view returns (" +
    "address buyer,address seller,uint256 price,uint256 verifierPool,uint256 sellerBudget," +
    "uint64 deadline,uint64 bidDeadline,bytes32 taskHash,bytes32 resultHash,string resultURI," +
    "uint8 state,uint8 quorumM,uint8 quorumN" +
  ")",
  "function isVerifierForTask(uint256 taskId, address v) view returns (bool)",
  "function hasApproved(uint256 taskId, address v) view returns (bool)"
];

const escrow = new ethers.Contract(ESCROW, abi, wallet);

// enum: NONE(0), CREATED(1), ACCEPTED(2), SUBMITTED(3)...
const STATE_SUBMITTED = 3;

// -------------------- Option B: Schema gate --------------------
// You can tighten over time. Keep it permissive at first.
const outputSchema = {
  type: "object",
  additionalProperties: true,
  required: ["type", "summary", "artifacts", "checks"],
  properties: {
    // Optional: if seller includes "task" or "intent" in output JSON, we’ll use it for Gemini context.
    task: { type: "string" },
    intent: { type: "string" },

    type: { type: "string", minLength: 3 },
    summary: { type: "string", minLength: 20 },
    artifacts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["name", "kind", "content"],
        properties: {
          name: { type: "string", minLength: 1 },
          kind: { type: "string", enum: ["text", "json", "code", "link"] },
          content: {}
        }
      }
    },
    checks: {
      type: "object",
      required: ["self_reported", "sources"],
      properties: {
        self_reported: { type: "array", items: { type: "string" }, minItems: 1 },
        sources: { type: "array", items: { type: "string" } }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(outputSchema);

// -------------------- Fix #4: fetch with timeout + retry --------------------
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { method: "GET", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithRetry(url) {
  let lastErr;
  for (let i = 0; i <= FETCH_RETRIES; i++) {
    try {
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < FETCH_RETRIES) await sleep(300 * (i + 1));
    }
  }
  throw lastErr;
}

// Resolve resultURI (ipfs:// -> gateway)
function normalizeURI(uri) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const cid = uri.slice("ipfs://".length);
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return uri;
}

// -------------------- Fix #2: robust JSON parsing --------------------
function parseJsonRobust(text) {
  if (!text) throw new Error("Empty response");

  // remove common markdown fences
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // fallback: extract first JSON object
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON object found");
  return JSON.parse(m[0]);
}

// -------------------- Fetch result JSON --------------------
async function fetchResultJSON(resultURI) {
  const url = normalizeURI(resultURI);
  const txt = await fetchTextWithRetry(url);
  return parseJsonRobust(txt);
}

// -------------------- Fix #1: get task intent/description --------------------
// Best: add task description on-chain. For now, we do:
// 1) if result JSON includes intent/task fields -> use those
// 2) else lookup by taskHash in TASK_INTENTS_JSON (offchain mapping)
// 3) else fallback to a generic description
function deriveTaskDescription(taskHashHex, resultObj) {
  const fromResult =
    (typeof resultObj?.intent === "string" && resultObj.intent.trim()) ||
    (typeof resultObj?.task === "string" && resultObj.task.trim());

  if (fromResult) return fromResult;

  const key1 = (typeof taskHashHex === "string") ? taskHashHex.toLowerCase() : "";
  const fromMap = (key1 && TASK_INTENTS[key1]) || TASK_INTENTS[taskHashHex] || "";
  if (fromMap) return fromMap;

  return "Unknown task intent. Judge correctness using consistency, completeness, and absence of red flags.";
}

// -------------------- Fix #3: gas strategy for approve() --------------------
async function approveWithGas(taskId) {
  const fee = await provider.getFeeData();

  // If the chain doesn't support EIP-1559, fall back to legacy gasPrice
  const overrides = {};
  if (fee.maxFeePerGas && fee.maxPriorityFeePerGas) {
    overrides.maxPriorityFeePerGas = fee.maxPriorityFeePerGas * GAS_TIP_MULT;
    overrides.maxFeePerGas = fee.maxFeePerGas * GAS_CAP_MULT;
  } else if (fee.gasPrice) {
    overrides.gasPrice = fee.gasPrice;
  }

  return escrow.approve(taskId, overrides);
}

// -------------------- Tiering --------------------
function tier(price) {
  if (price < SMALL_TASK_PRICE) return "SMALL";
  if (price >= BIG_TASK_PRICE) return "BIG";
  return "MED";
}

function pickThreshold(price) {
  return price >= BIG_TASK_PRICE ? AI_SCORE_THRESHOLD_BIG : AI_SCORE_THRESHOLD_MED;
}

// -------------------- Option C: Gemini scoring --------------------
async function geminiScore({ description, taskHash, resultObj, taskMeta }) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing (needed for MED/BIG)");

  const prompt = `
You are a verifier agent for an onchain agent marketplace.

Return STRICT JSON ONLY (no markdown, no prose outside JSON):
{
  "score": number,          // 0..1
  "verdict": "approve"|"hold"|"reject",
  "reasons": string[],
  "flags": string[]
}

Task requirement (intent):
${description}

Onchain meta:
- taskHash: ${taskHash}
- seller: ${taskMeta.seller}
- price: ${taskMeta.price}
- quorum: ${taskMeta.quorumM}/${taskMeta.quorumN}

Submitted result JSON:
${JSON.stringify(resultObj, null, 2)}

Rules:
- Approve only if result satisfies the task requirement and has no major red flags.
- Hold if unclear but not obviously wrong.
- Reject if misleading, inconsistent, unverifiable, or suspicious.
`;

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(GEMINI_KEY);

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
  });

  let lastErr;
  for (let i = 0; i <= FETCH_RETRIES; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

      const parsed = parseJsonRobust(text);

      const score = Number(parsed.score);
      if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Gemini score invalid");

      return {
        score,
        verdict: parsed.verdict,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
        flags: Array.isArray(parsed.flags) ? parsed.flags : []
      };
    } catch (e) {
      lastErr = e;
      if (i < FETCH_RETRIES) await sleep(300 * (i + 1));
    }
  }

  throw lastErr;
}

// -------------------- Race safety --------------------
const inFlight = new Set();
const RECENT = new Map();
const TTL = 30_000;

function markRecent(id) { RECENT.set(id, Date.now()); }
function isRecent(id) {
  const t = RECENT.get(id);
  if (!t) return false;
  if (Date.now() - t > TTL) { RECENT.delete(id); return false; }
  return true;
}

async function approveTx(taskId, id, label) {
  console.log(`✅ task ${id}: approving (${label})...`);
  const tx = await approveWithGas(taskId);
  console.log("📤 approve tx:", tx.hash);
  const rc = await tx.wait();
  console.log(`🎉 task ${id}: approved (${label}) | block: ${rc.blockNumber}`);
}

// -------------------- Main handler --------------------
async function handleTask(taskId) {
  const id = String(taskId);
  if (inFlight.has(id) || isRecent(id)) return;
  inFlight.add(id);

  try {
    const t = await escrow.tasks(taskId);
    if (Number(t.state) !== STATE_SUBMITTED) { markRecent(id); return; }

    const allowed = await escrow.isVerifierForTask(taskId, wallet.address);
    if (!allowed) { markRecent(id); return; }

    const already = await escrow.hasApproved(taskId, wallet.address);
    if (already) { markRecent(id); return; }

    if (!t.resultURI || t.resultURI.length < 5) {
      console.log(`⏸️ task ${id}: missing resultURI`);
      markRecent(id);
      return;
    }

    // Fetch + parse result JSON
    const resultObj = await fetchResultJSON(t.resultURI);

    // Option B: schema gate
    const okSchema = validateOutput(resultObj);
    if (!okSchema) {
      console.log(`❌ task ${id}: schema FAIL`);
      console.log(validateOutput.errors);
      markRecent(id);
      return;
    }

    const price = BigInt(t.price.toString());
    const taskTier = tier(price);

    // SMALL: schema-only approve
    if (taskTier === "SMALL") {
      await approveTx(taskId, id, "schema-only");
      markRecent(id);
      return;
    }

    // MED/BIG: schema + Gemini
    const threshold = pickThreshold(price);

    const taskHashHex = (typeof t.taskHash === "string") ? t.taskHash : String(t.taskHash);
    const description = deriveTaskDescription(taskHashHex, resultObj);

    const ai = await geminiScore({
      description,
      taskHash: taskHashHex,
      resultObj,
      taskMeta: {
        seller: t.seller,
        price: t.price.toString(),
        quorumM: Number(t.quorumM),
        quorumN: Number(t.quorumN)
      }
    });

    console.log(
      `🧠 task ${id}: tier=${taskTier} score=${ai.score} verdict=${ai.verdict} threshold=${threshold}`
    );

    if (ai.verdict === "reject" || ai.score < threshold) {
      console.log(`⛔ task ${id}: NOT approving (AI gate). flags=`, ai.flags);
      markRecent(id);
      return;
    }

    await approveTx(taskId, id, "schema+AI");
    markRecent(id);
  } catch (e) {
    console.error(`❌ task ${id} error:`, e?.reason || e?.message || e);
    markRecent(id);
  } finally {
    inFlight.delete(id);
  }
}

async function poll() {
  try {
    const counter = Number(await escrow.taskCounter());
    const lookback = 50;
    const start = Math.max(1, counter - lookback);
    for (let id = start; id <= counter; id++) {
      await handleTask(id);
    }
  } catch (e) {
    console.error("Poll error:", e?.message || e);
  }
}

async function main() {
  console.log("🧾 Verifier bot running (SMALL: schema-only, MED/BIG: schema+Gemini)");
  console.log("Escrow:", ESCROW);
  console.log("Verifier:", wallet.address);
  console.log("Polling ms:", POLL_MS);
  console.log("Timeout ms:", FETCH_TIMEOUT_MS, "retries:", FETCH_RETRIES);
  console.log("Gas multipliers:", { tip: GAS_TIP_MULT.toString(), cap: GAS_CAP_MULT.toString() });

  if (!GEMINI_KEY) {
    console.log("⚠️ GEMINI_API_KEY missing: MED/BIG tasks will NOT approve (SMALL still works).");
  }

  setInterval(poll, POLL_MS);

  process.on("SIGINT", () => process.exit(0));
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});