import axios from 'axios';

const HUB_URL = "https://arc-agent-economy.onrender.com";

async function verifyMasterWallet() {
    try {
        console.log(`Checking Admin wallet address on Hub...`);
        const resp = await axios.post(`${HUB_URL}/agent/verify`, {
            agentName: "Admin",
            agentSecret: "SOVEREIGN_ADMIN_2026"
        });
        console.log("Admin Wallet ID:", resp.data.walletId);
    } catch (e) {
        console.error("Error:", e.response?.data || e.message);
    }
}

verifyMasterWallet();
