import axios from 'axios';

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function withdrawMaster() {
    console.log(`Pinging Render Backend at ${HUB_URL}...`);
    try {
        const payload = {
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026",
            amount: "0.18" // Exact available balance
        };

        console.log(`Sending Gateway Withdraw Request for exactly 0.18 USDC...`);
        const resp = await axios.post(`${HUB_URL}/agent/gateway-withdraw`, payload, { timeout: 300000 });
        console.log("SUCCESS!");
        console.log(JSON.stringify(resp.data, null, 2));

    } catch (e) {
        if (e.response) {
            console.error("ERROR from Server:", e.response.status, e.response.data);
        } else {
            console.error("Network Error:", e.message);
        }
    }
}

withdrawMaster();
