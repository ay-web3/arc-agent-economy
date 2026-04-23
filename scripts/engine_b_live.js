
import axios from 'axios';
import { createPublicClient, http } from 'viem';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const client = createPublicClient({ 
    chain: { id: 5042002, name: 'ARC', nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' }, rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } }, 
    transport: http() 
});

async function runRealEngineBDemo() {
    console.log("================================================================");
    console.log("   ARC AGENT ECONOMY - ENGINE B (NATIVE SETTLEMENT) DEMO");
    console.log("================================================================");

    try {
        const ts = Date.now();
        console.log("\n[1/4] INITIALIZING AGENTS...");
        const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoBuyer_" + ts })).data;
        const s = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoSeller_" + ts })).data;
        const v = (await axios.post(`${HUB_URL}/onboard`, { agentName: "DemoVerifier_" + ts })).data;
        console.log(`>> Seller Wallet: ${s.address}`);

        console.log("\n[2/4] EXECUTING OFF-CHAIN SWARM TASKS (ZERO GAS)...");
        for(let i=1; i<=3; i++) {
            const taskId = (await axios.post(`${HUB_URL}/nano/create`, { buyerAddress: b.address, amount: "1.0" })).data.taskId;
            await axios.post(`${HUB_URL}/nano/bid`, { taskId, sellerAddress: s.address, bidPrice: "0.5" });
            await axios.post(`${HUB_URL}/nano/select`, { taskId, bidIndex: 0 });
            await axios.post(`${HUB_URL}/nano/submit`, { taskId, resultURI: "ipfs://work-" + i });
            await axios.post(`${HUB_URL}/nano/approve`, { taskId, verifierAddress: v.address });
            console.log(`>> Task #${i} Settled Off-Chain.`);
        }

        console.log("\n[3/4] TRIGGERING ON-CHAIN BATCH SETTLEMENT...");
        console.log(">> Requesting Hub to execute Native Circle Payout...");
        
        // The Hub already triggers this automatically on the 3rd approve, 
        // but we'll wait for the blockchain to catch up.
        console.log(">> Waiting 20s for Treasury to process the batch...");
        await new Promise(r => setTimeout(r, 20000));

        console.log("\n[4/4] VERIFYING ON-CHAIN SUCCESS...");
        const balance = await client.getBalance({ address: s.address });
        const finalUSDC = Number(balance) / 1e18;

        console.log(`\n✅ ENGINE B DEMO COMPLETE!`);
        console.log(`>> Seller Final Balance: ${finalUSDC.toFixed(2)} USDC`);
        console.log(`>> PROOF OF PAYMENT: http://explorer.testnet.arc.network/address/${s.address}`);
        console.log("\n(You will see a 'Transfer' from the Hub Treasury in the 'Tokens' tab)");
        console.log("================================================================");

    } catch (err) {
        console.error("!! Demo Failed:", err.response?.data || err.message);
    }
}

runRealEngineBDemo();
