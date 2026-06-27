const HUB_URL = "https://arc-agent-economy.onrender.com";
const agentName = "FullDemoAgent_" + Date.now();
const agentSecret = "my_super_secret_password";

async function run() {
    console.log(`\n======================================================`);
    console.log(`>> 1. ONBOARDING: ${agentName}`);
    console.log(`======================================================`);
    console.log(`(This contacts the Circle API to create a new Developer-Controlled Wallet)`);
    
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

    console.log(`\n======================================================`);
    console.log(`>> 2. REGISTRATION (SIGNING THE DIGITAL CHECK)`);
    console.log(`======================================================`);
    console.log(`(This uses the new wallet to sign a 3.00 USDC EIP-712 BurnIntent)`);
    
    const regRes = await fetch(`${HUB_URL}/api/registry/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: agentName,
            url: `http://${agentName.toLowerCase()}.local`,
            price: 0.1,
            description: "A full end-to-end test agent"
        })
    });
    console.log(await regRes.text());

    console.log(`\n======================================================`);
    console.log(`>> 3. MALICIOUS BEHAVIOR & SLASHING`);
    console.log(`======================================================`);
    
    console.log(`[Rating 1/3] Consumer submits 1 star...`);
    const r1 = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, rating: 1, receipt: "Bearer DUMMY", prompt: "A", signal: "B" })
    });
    console.log(await r1.text());

    console.log(`[Rating 2/3] Consumer submits 1 star...`);
    const r2 = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `http://${agentName.toLowerCase()}.local`, rating: 1, receipt: "Bearer DUMMY", prompt: "A", signal: "B" })
    });
    console.log(await r2.text());

    console.log(`[Rating 3/3] Consumer submits 1 star (with proof) - Triggering AI Supreme Court...`);
    const rateRes = await fetch(`${HUB_URL}/api/registry/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: `http://${agentName.toLowerCase()}.local`,
            rating: 1,
            receipt: "Bearer DUMMY",
            prompt: "What is 2+2?",
            signal: "Potato" // Clearly a bad response, AI should judge FAIR
        })
    });
    console.log(await rateRes.text());
}
run();
