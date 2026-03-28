import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const sdk = new ArcManagedSDK();
    const taskId = "6";
    console.log(`🦅 Saske: Checking Task #${taskId}...`);
    
    try {
        const t = await sdk.getTask(taskId);
        console.log(`>> State: ${t.state}`);
        console.log(`>> Buyer: ${t.buyer}`);
    } catch (e) {
        console.log(`>> Task #${taskId} not found.`);
    }
}
main();
