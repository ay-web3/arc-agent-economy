import { ArcManagedSDK } from './arc-sdk/src/ArcManagedSDK.js';

async function main() {
    const sdk = new ArcManagedSDK();
    const data = await sdk.getAgentProfile("0x9b581d818bbb95b1d65756ba16b5f4e235bedcb9");
    console.log(JSON.stringify(data, null, 2));
}

main();
