const HUB_URL = "https://arc-agent-economy.onrender.com";

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBounties() {
    console.log("=== STARTING TASK BOARD TEST ===\n");

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
    console.log(`   Buyer onboarded! Address: ${buyer.walletAddress}`);
    
    // 2. Onboard Seller
    console.log(`2. Onboarding Seller: ${sellerName}...`);
    res = await fetch(`${HUB_URL}/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: sellerName })
    });
    const seller = await res.json();
    console.log(`   Seller onboarded! Address: ${seller.walletAddress}`);

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
            description: "Expert analysis and coding."
        })
    });
    const regRes = await res.json();
    console.log(`   Seller registration result:`, regRes);

    // 4. Create Task (Buyer)
    console.log(`\n4. Buyer creating a task with budget 0.05 - 0.20 USDC...`);
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    res = await fetch(`${HUB_URL}/api/tasks/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyer.agentSecret,
            title: "Build a React component",
            description: "Need a simple React component for a data table.",
            minBudget: 0.05,
            maxBudget: 0.20,
            deadline: deadline
        })
    });
    const createRes = await res.json();
    console.log(`   Task creation result:`, createRes);
    
    if (!createRes.success) {
        console.error("Test failed at task creation. Exiting.");
        return;
    }
    const taskId = createRes.taskId;

    // 5. Bid on Task (Seller)
    console.log(`\n5. Seller bidding on task ${taskId}...`);
    res = await fetch(`${HUB_URL}/api/tasks/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: sellerName,
            agentSecret: seller.agentSecret,
            taskId: taskId,
            price: 0.15,
            pitch: "I have 5 years of React experience. I can do this fast."
        })
    });
    const bidRes = await res.json();
    console.log(`   Bid result:`, bidRes);

    if (!bidRes.success) {
        console.error("Test failed at bidding. Exiting.");
        return;
    }
    const bidId = bidRes.bidId;

    // 6. Accept Bid (Buyer)
    console.log(`\n6. Buyer accepting bid ${bidId}...`);
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
    const acceptRes = await res.json();
    console.log(`   Accept result:`, acceptRes);

    // 7. Submit Result (Seller)
    console.log(`\n7. Seller submitting result...`);
    res = await fetch(`${HUB_URL}/api/tasks/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: sellerName,
            agentSecret: seller.agentSecret,
            taskId: taskId,
            result: "export default function DataTable() { return <table>...</table>; }"
        })
    });
    const submitRes = await res.json();
    console.log(`   Submit result:`, submitRes);

    // 8. Approve Result (Buyer)
    console.log(`\n8. Buyer approving result (releasing escrow)...`);
    res = await fetch(`${HUB_URL}/api/tasks/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agentName: buyerName,
            agentSecret: buyer.agentSecret,
            taskId: taskId
        })
    });
    const approveRes = await res.json();
    console.log(`   Approve result:`, approveRes);

    console.log("\n=== TEST COMPLETE ===");
}

testBounties().catch(console.error);
