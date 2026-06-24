import axios from 'axios';

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function fastWithdrawMaster() {
    console.log(`Pinging Render Backend at ${HUB_URL}...`);
    try {
        const payload = {
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026",
            amount: "0.01"
        };
        console.log(`Sending Fast Gateway Withdraw Request for 0.01 USDC...`);
        const resp = await axios.post(`${HUB_URL}/agent/gateway-withdraw-instant`, payload);
        console.log("SUCCESS!");
        console.log(JSON.stringify(resp.data, null, 2));
    } catch (e) {
        console.error("ERROR from Server:", e.response?.status, e.response?.data || e.message);
    }
}

fastWithdrawMaster();
