
import axios from 'axios';
import { createPublicClient, http, parseAbi } from 'viem';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIG ---
const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const PAYMIND_URL = "http://34.123.224.26:3000";
const PAYMIND_MANAGER = "0x65b685fCF501D085C80f0D99CFA883cFF3445ff2";
const PAYMIND_CONTRACT = PAYMIND_MANAGER;
const EXPLORER_BASE = "https://explorer.testnet.arc.network/tx/";

// Persistent Identities (Funded)
const b = { 
    id: process.env.AGENT_BUYER_ID || "Fortress_Buyer_1777068145146", 
    secret: process.env.AGENT_BUYER_SECRET || "b4d969b5a19fb30695ab757aa371c73ba7cf05052cf70a1a96dce5015a7e691f",
    address: process.env.AGENT_BUYER_ADDRESS || "0x09eed642b2a45ad10fdf91ec43054c387deab68f"
};
const s = { 
    id: process.env.AGENT_SELLER_ID || "Fortress_Seller_1777068145146", 
    secret: process.env.AGENT_SELLER_SECRET || "4d54a7ce04f830012c95ecae5575fbba496e2feb1b822533fc075eabf0daa569",
    address: process.env.AGENT_SELLER_ADDRESS || "0x6a8fb1d3f12d1e3ae0e73ed2bb03f2082542cb87"
};
const v = { 
    id: process.env.AGENT_VERIFIER_ID || "Fortress_Verifier_1777068145146", 
    secret: process.env.AGENT_VERIFIER_SECRET || "7b1faf64cf4476a908d362817b2723044097f0e71e9358c6eb5d08a9b5d7fbe9",
    address: process.env.AGENT_VERIFIER_ADDRESS || "0x9fd46a0510cca5e813d37298cb8c53cd6861b66f"
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runSwarmDemo() {
    console.log("\n================================================================");
    console.log("   🐝 ARC SWARM VELOCITY DEMO: ENGINE B (MAX PERFORMANCE) 🐝");
    console.log("================================================================\n");

    const tStart = Date.now();

    try {
        // 1. Initial Deposit to Nano-Ledger
        console.log(">> [HUB] Funding Nano-Ledger for Swarm Execution...");
        const rDep = await axios.post(`${HUB_URL}/execute/depositNanoBalance`, { 
            agentId: b.id, agentSecret: b.secret, amount: "1.0" 
        });
        console.log(`   Deposit Success: ${EXPLORER_BASE}${rDep.data.txId}`);
        await sleep(5000);

        // 2. Ensure Paymind Vault exists
        console.log(">> [BRIDGE] Checking Seller's Paymind Vault...");
        const pc = createPublicClient({ chain: { id: 5042002, name: 'ARC', rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, transport: http() });
        let vault = await pc.readContract({
            address: PAYMIND_MANAGER,
            abi: parseAbi(['function userToAgent(address user) view returns (address)']),
            functionName: 'userToAgent', args: [s.address]
        });

        if (vault === "0x0000000000000000000000000000000000000000") {
            console.log("   Vault missing. Triggering Onboarding...");
            await axios.post(`${HUB_URL}/execute/paymindOnboard`, { agentId: s.id, agentSecret: s.secret });
            await sleep(15000);
            vault = await pc.readContract({ address: PAYMIND_MANAGER, abi: parseAbi(['function userToAgent(address user) view returns (address)']), functionName: 'userToAgent', args: [s.address] });
        }
        console.log(`   Seller Vault Ready: ${vault}`);

        // 3. Swarm Loop
        const tasks = [
            { desc: "Institutional BTC Analysis", coin: "bitcoin" },
            { desc: "Institutional BNB Analysis", coin: "binancecoin" },
            { desc: "Institutional USDC Stability Report", coin: "usd-coin" }
        ];

        console.log(`\n>> [SWARM] Launching ${tasks.length} High-Velocity Tasks...`);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            console.log(`\n--- Task #${i+1}: ${task.desc} ---`);

            // Nano-Task Lifecycle (Zero-Gas Off-Chain)
            const { taskId } = (await axios.post(`${HUB_URL}/nano/create`, { 
                agentName: b.id, agentSecret: b.secret, amount: "0.006", description: task.desc 
            })).data;
            
            await axios.post(`${HUB_URL}/nano/bid`, { agentName: s.id, agentSecret: s.secret, taskId, bidPrice: "0.006" });
            await axios.post(`${HUB_URL}/nano/select`, { agentName: b.id, agentSecret: b.secret, taskId, bidIndex: 0 });

            // Paymind Bridge (The Real x402 Commerce)
            console.log(`   >> [PAYMIND] Seller purchasing detailed data for ${task.coin.toUpperCase()}...`);
            try {
                // Check if vault needs funding
                const USDC_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
                const NATIVE_USDC = "0x3600000000000000000000000000000000000000";
                const vaultBalance = await pc.readContract({
                    address: NATIVE_USDC,
                    abi: USDC_ABI,
                    functionName: 'balanceOf',
                    args: [vault]
                });
                
                const balanceFormatted = Number(vaultBalance) / 1e6;
                if (balanceFormatted < 0.01) {
                    console.log(`   Vault low (${balanceFormatted} USDC). Funding 1.0 USDC...`);
                    await axios.post(`${HUB_URL}/execute/paymindPay`, { 
                        agentId: s.id, agentSecret: s.secret, vaultAddress: vault, amount: "1.0" 
                    });
                    console.log(`   [SUCCESS] 1.0 USDC sent to Paymind Vault.`);
                    await sleep(5000);
                } else {
                    console.log(`   Vault has sufficient funds (${balanceFormatted.toFixed(3)} USDC). Skipping funding.`);
                }

                const pRes = await axios.post(`${PAYMIND_URL}/analysis`, { 
                    userAddress: s.address, coin: task.coin, tf: "1h" 
                });
                const intelligence = pRes.data.analysis.explanation;
                console.log(`   [SUCCESS] High-Fidelity Data Secured. Length: ${intelligence.length} chars.`);

                // Host Branded Report
                const reportRes = await axios.post(`${PAYMIND_URL}/report/store`, { 
                    taskId: taskId.toString(), resultHash: "0x" + uuidv4().replace(/-/g, ''), data: intelligence 
                });
                const reportUrl = reportRes.data.url;

                await axios.post(`${HUB_URL}/nano/submit`, { 
                    agentName: s.id, agentSecret: s.secret, taskId, resultURI: reportUrl 
                });
                await axios.post(`${HUB_URL}/nano/approve`, { 
                    agentName: v.id, agentSecret: v.secret, taskId, verifierAddress: v.address 
                });
                console.log(`   Task Completed. Evidence: ${reportUrl}`);
            } catch (e) {
                console.log(`   [ERROR] Bridge Failed: ${e.response?.data?.error || e.message}`);
            }
        }

        console.log("\n>> [BATCH] Swarm Complete. Hub is settling all tasks in ONE transaction...");
        await sleep(20000); // Server-side batch window
        
        const tEnd = Date.now();
        console.log("\n================================================================");
        console.log(`✅ SWARM DEMO FINISHED in ${((tEnd - tStart)/1000).toFixed(1)}s`);
        console.log(`🚀 Efficiency: 1 Transaction for ${tasks.length} High-Fidelity Tasks.`);
        console.log("================================================================\n");

    } catch (e) {
        console.log("!! Swarm Demo Failed:", e.response?.data || e.message);
    }
}

runSwarmDemo();
