const axios = require('axios');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key) acc[key.trim()] = rest.join('=').trim();
    return acc;
}, {});

(async () => {
    try {
        const resp = await axios.get(`https://api.circle.com/v1/w3s/transactions?walletIds=${env.MASTER_WALLET_ID}`, {
            headers: {
                'Authorization': `Bearer ${env.CIRCLE_API_KEY}`
            }
        });
        console.log(JSON.stringify(resp.data.data.transactions, null, 2));
    } catch(e) {
        console.error(e.response?.data || e.message);
    }
})();
