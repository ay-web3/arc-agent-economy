import fs from 'fs';

async function runFlow() {
    const API_URL = "https://arc-agent-economy.onrender.com";
    
    // Load credentials
    const buyerInfo = JSON.parse(fs.readFileSync('./.agent_secret', 'utf8').replace(/^\uFEFF/, ''));
    const sellerInfo = JSON.parse(fs.readFileSync('../football_service/agent_secret.json', 'utf8').replace(/^\uFEFF/, ''));

    const buyerName = buyerInfo.agentId || buyerInfo.agentName;
    const buyerSecret = buyerInfo.agentSecret;

    const sellerName = sellerInfo.agentName;
    const sellerSecret = sellerInfo.agentSecret;

    console.log(`Buyer: ${buyerName}`);
    console.log(`Seller: ${sellerName}`);

    // 0. Register/Stake Seller
    console.log("\n0. Staking Seller via Registry...");
    const regReq = await fetch(`${API_URL}/api/registry/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: sellerName,
            url: "http://localhost:3000/test",
            price: 0.001,
            description: "Testing the flow"
        })
    });
    console.log(await regReq.text());



    // 1. Create Task
    console.log("\n1. Creating Task...");
    const createReq = await fetch(`${API_URL}/api/tasks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyerSecret,
            title: "Test Bounty Flow " + Date.now(),
            description: "A quick test to verify on-chain settlement.",
            minBudget: 0.001,
            maxBudget: 0.005,
            deadline: new Date(Date.now() + 86400000).toISOString() // 1 day from now
        })
    });
    const createRes = await createReq.json();
    console.log(createRes);
    if (!createRes.taskId) return;
    const taskId = createRes.taskId;

    // 2. Bid on Task
    console.log("\n2. Bidding on Task...");
    const bidReq = await fetch(`${API_URL}/api/tasks/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentName: sellerName,
            agentSecret: sellerSecret,
            taskId: taskId,
            price: 0.003
        })
    });
    const bidRes = await bidReq.json();
    console.log(bidRes);
    if (!bidRes.bidId) return;
    const bidId = bidRes.bidId;

    // 3. Accept Bid
    console.log("\n3. Accepting Bid...");
    const acceptReq = await fetch(`${API_URL}/api/tasks/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyerSecret,
            taskId: taskId,
            bidId: bidId
        })
    });
    console.log(await acceptReq.json());

    // 4. Submit Task
    console.log("\n4. Submitting Task...");
    const submitReq = await fetch(`${API_URL}/api/tasks/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentName: sellerName,
            agentSecret: sellerSecret,
            taskId: taskId,
            result: "Here is the test solution."
        })
    });
    console.log(await submitReq.json());

    // 5. Approve Task (Triggers On-Chain Payment)
    console.log("\n5. Approving Task (Settling On-Chain)...");
    const approveReq = await fetch(`${API_URL}/api/tasks/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyerSecret,
            taskId: taskId
        })
    });
    const approveRes = await approveReq.json();
    console.log(approveRes);
    if (approveRes.success && approveRes.txId) {
        console.log(`\n✅ SUCCESS! Payment executed on-chain.`);
        console.log(`Transaction ID: ${approveRes.txId}`);
    } else {
        console.log(`\n❌ FAILED to execute payment.`);
    }
}

runFlow().catch(console.error);
