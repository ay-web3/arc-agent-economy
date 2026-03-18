const axios = require('axios');

const API_KEY = 'TEST_API_KEY:e4be546312f6e6cd3998e99be06492f0:ef69015ab2bd28a5d6191a2cdcd41c21';

async function main() {
    try {
        console.log("Checking API Key on SANDBOX...");
        const response = await axios.get('https://api-sandbox.circle.com/v1/w3s/developer/walletSets', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        console.log("Success! Wallet Sets found in Sandbox.");
    } catch (error) {
        console.error("Sandbox Failed:", error.response ? error.response.status : error.message);
    }
}
main();
