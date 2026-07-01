const HUB_URL = "https://arc-agent-economy.onrender.com";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDispute() {
    console.log("=== STARTING TASK BOARD DISPUTE TEST ===\n");

    const buyerName = "TestBuyer_" + Date.now();
    const sellerName = "TestSeller_" + Date.now();

    // 1. Onboard Buyer
    console.log(`1. Onboarding Buyer: ${buyerName}...`);
    let res = await fetch(`${HUB_URL}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: buyerName })
    });
    const buyer = await res.json();
    
    // 2. Onboard Seller
    console.log(`2. Onboarding Seller: ${sellerName}...`);
    res = await fetch(`${HUB_URL}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: sellerName })
    });
    const seller = await res.json();

    console.log("\nWaiting 10 seconds for initial funding transactions to settle...");
    await delay(10000);

    // 3. Register Seller (Stake 3.00 USDC)
    console.log(`\n3. Registering Seller Service (Staking 3.00 USDC)...`);
    res = await fetch(`${HUB_URL}/api/registry/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: sellerName,
            url: "https://test-seller.example.com",
            price: 0.1,
            description: "Expert python coder."
        })
    });
    const regRes = await res.json();

    // 4. Create Task (Buyer)
    console.log(`\n4. Buyer creating a task...`);
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    res = await fetch(`${HUB_URL}/api/tasks/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyer.agentSecret,
            title: "Write a python function to add two numbers",
            description: "I need a simple python function that takes two arguments and returns their sum.",
            minBudget: 0.05,
            maxBudget: 0.10,
            deadline: deadline
        })
    });
    const createRes = await res.json();
    const taskId = createRes.taskId;
    console.log(`   Task created: ${taskId}`);

    // 5. Bid on Task (Seller)
    console.log(`\n5. Seller bidding on task...`);
    res = await fetch(`${HUB_URL}/api/tasks/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: sellerName,
            agentSecret: seller.agentSecret,
            taskId: taskId,
            price: 0.08,
            pitch: "I can write this function perfectly."
        })
    });
    const bidRes = await res.json();
    const bidId = bidRes.bidId;

    // 6. Accept Bid (Buyer)
    console.log(`\n6. Buyer accepting bid...`);
    res = await fetch(`${HUB_URL}/api/tasks/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyer.agentSecret,
            taskId: taskId,
            bidId: bidId
        })
    });

    // 7. Submit Result (Seller) - Seller provides a PERFECT response
    console.log(`\n7. Seller submitting PERFECT result...`);
    res = await fetch(`${HUB_URL}/api/tasks/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: sellerName,
            agentSecret: seller.agentSecret,
            taskId: taskId,
            result: "def add(a, b):\n    return a + b"
        })
    });

    // 8. Dispute Result (Buyer) - Buyer makes a MALICIOUS dispute
    console.log(`\n8. Buyer initiating a MALICIOUS dispute...`);
    console.log(`   (The buyer is lying to avoid paying for perfect work)`);
    res = await fetch(`${HUB_URL}/api/tasks/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyer.agentSecret,
            taskId: taskId,
            reason: "This code is completely wrong, it doesn't add numbers at all. It deletes files from my computer. I refuse to pay."
        })
    });
    
    console.log("\nWAITING FOR AI SUPREME COURT VERDICT...");
    const disputeRes = await res.json();
    
    console.log("\n=== DISPUTE RESOLUTION ===");
    console.log(`VERDICT: ${disputeRes.verdict}`);
    console.log(`RESOLUTION: ${disputeRes.resolution}`);
    
    console.log("\n=== TEST COMPLETE ===");
}

testDispute().catch(console.error);
