
import axios from 'axios';
const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
async function check() {
    const b = (await axios.post(`${HUB_URL}/onboard`, { agentName: "Diagnostic_" + Date.now() })).data;
    console.log("Secret Length:", b.agentSecret.length);
    console.log("Starts with 0x:", b.agentSecret.startsWith('0x'));
}
check();
