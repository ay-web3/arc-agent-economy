const HUB_URL = "https://arc-agent-economy.onrender.com";
const agentName = "TrueSlashAgent_" + Date.now();
const agentSecret = "my_super_secret_password";

async function run() {
    console.log(`\n======================================================`);
    console.log(`>> 1. ONBOARDING: ${agentName}`);
    console.log(`======================================================`);
    console.log(`(This contacts the Circle API to create a new Developer-Controlled Wallet and requests USDC from the Faucet)`);
    
    const onboardRes = await fetch(`${HUB_URL}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, agentSecret })
    });
    const onboardData = await onboardRes.json();
    console.log(onboardData);

    if (onboardData.error) {
        console.error("Onboarding failed, stopping demo.");
        return;
    }

    console.log(`\nWaiting 10 seconds for the Circle Faucet to deliver the USDC to the wallet...`);
    await new Promise(r => setTimeout(r, 10000));

    console.log(`\n======================================================`);
    console.log(`>> 2. GATEWAY DEPOSIT (STAKING THE 3.00 USDC)`);
    console.log(`======================================================`);
    console.log(`(This submits 'approve' and 'deposit' transactions to move 3.00 USDC from the agent's wallet into the Gateway Escrow)`);
    console.log(`(This will take about ~30-60 seconds to wait for block confirmations...)`);

    const depositRes = await fetch(`${HUB_URL}/agent/gateway-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, agentSecret: onboardData.agentSecret, amount: "3.0" })
    });
    const depositData = await depositRes.json();
    console.log(depositData);

    if (depositData.error) {
        console.error("Gateway deposit failed. The faucet might not have delivered enough USDC.");
        return;
    }

    console.log(`\n======================================================`);
    console.log(`>> 3. REGISTRATION (SIGNING THE DIGITAL CHECK)`);
    console.log(`======================================================`);
    console.log(`(This uses the wallet to sign the 3.00 USDC EIP-712 BurnIntent)`);
    
    const regRes = await fetch(`${HUB_URL}/api/registry/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: agentName,
            url: `http://${agentName.toLowerCase()}.local`,
            price: 0.1,
            description: "A fully staked end-to-end test agent"
        })
    });
    console.log(await regRes.text());

    console.log(`\n======================================================`);
    console.log(`>> 4. MALICIOUS BEHAVIOR & SLASHING (ON-CHAIN)`);
    console.log(`======================================================`);
    
    console.log(`[Job 1/3] Agent performs work (Broadcasted to Stream)...`);
    await fetch(`${HUB_URL}/api/registry/log-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, prompt: "A" })
    });
    console.log(`[Rating 1/3] Consumer submits 1 star...`);
    await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, rating: 1, receipt: "Bearer DUMMY", prompt: "A", signal: "B" })
    });

    console.log(`[Job 2/3] Agent performs work (Broadcasted to Stream)...`);
    await fetch(`${HUB_URL}/api/registry/log-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, prompt: "A" })
    });
    console.log(`[Rating 2/3] Consumer submits 1 star...`);
    await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, rating: 1, receipt: "Bearer DUMMY", prompt: "A", signal: "B" })
    });

    console.log(`[Job 3/3] Agent performs work (Broadcasted to Stream)...`);
    await fetch(`${HUB_URL}/api/registry/log-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, prompt: "What is 2+2?" })
    });
    console.log(`[Rating 3/3] Consumer submits 1 star (with proof) - Triggering AI Supreme Court...`);
    const rateRes = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: `http://${agentName.toLowerCase()}.local`,
            rating: 1,
            receipt: "Bearer DUMMY",
            prompt: "What is 2+2?",
            signal: "Potato" 
        })
    });
    console.log(await rateRes.text());

    console.log(`\n✅ Slashed! The Hub has executed the BurnIntent via the Gateway API.`);
}
run();
