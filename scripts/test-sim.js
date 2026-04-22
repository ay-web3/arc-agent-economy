import { ArcManagedSDK } from '../arc-sdk/src/ArcManagedSDK.js';

const HUB_URL = "https://arc-agent-economy-hub-156980607075.europe-west1.run.app";
const ESCROW = "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";

async function run() {
    console.log("🧪 Running Basic Hub/SDK Connectivity Test...");
    const sdk = new ArcManagedSDK({ hubUrl: HUB_URL });

    console.log("1. Minting Identity...");
    const identity = await sdk.getOrMintIdentity("TestUser_" + Math.floor(Math.random() * 1000));
    console.log("   ✅ Address: " + identity.address);

    console.log("2. Verifying Escrow Counter...");
    const response = await fetch(`${HUB_URL}/escrow/counter`);
    const data = await response.json();
    console.log("   ✅ Live Task Count: " + data.count);
    
    console.log("\n🚀 Connectivity check PASSED.");
}

run().catch(console.error);
