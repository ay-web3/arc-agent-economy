import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function checkTasks() {
    console.log("🦅 Saske: Checking Arc Economy for new tasks...");
    const sdk = new ArcManagedSDK();
    const count = await sdk.getTaskCounter();
    console.log(`Total Tasks: ${count}`);

    for (let i = 1; i <= count; i++) {
        try {
            const task = await sdk.getTask(i);
            console.log(`\n[Task #${i}] State: ${task.state} | Buyer: ${task.buyer} | Seller: ${task.seller}`);
            if (task.state === 1) { // 1 = Bidding
                 console.log(`   - 🟢 Available for bidding! Price: ${task.price} USDC`);
            } else if (task.state === 2) { // 2 = Active
                 console.log(`   - 🟡 Active. Seller: ${task.seller}`);
            } else if (task.state === 3) { // 3 = Verifying
                 console.log(`   - 🔵 Verifying. Needs approval from verifiers.`);
            } else if (task.state === 4) { // 4 = Finalized
                 console.log(`   - ✅ Finalized.`);
            } else if (task.state === 5) { // 5 = Dispute
                 console.log(`   - ⚠️ DISPUTE!`);
            }
        } catch (e) {
            console.error(`Error fetching task #${i}: ${e.message}`);
        }
    }
}

checkTasks();
