const { ethers } = require("./node_modules/ethers");

const REGISTRY_ADDR = "0x700016cB8a2F8Ec7B41c583Cc42589Fd230752f9";
const REGISTRY_ABI = [
    "function register(bool asSeller, bool asVerifier, bytes32 capabilitiesHash, bytes32 pubKey) external payable",
    "function profile(address agent) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)"
];

async function main() {
    const pk = "0x22d4e1a6811fc2c5bb56363c7515b369cacd5e3e202aa5d608ffca73ab3806f7"; 
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const wallet = new ethers.Wallet(pk, provider);
    const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);

    console.log(`Starting registration for: ${wallet.address}`);

    try {
        const capabilitiesHash = ethers.id("saske-ai-agent-v1");
        const pubKey = ethers.id(wallet.address); // Placeholder pubKey

        console.log("Sending registration transaction (50.0 USDC stake)...");
        const tx = await registry.register(
            true,  // asSeller
            false, // asVerifier
            capabilitiesHash,
            pubKey,
            { value: ethers.parseUnits("50.0", 18) }
        );

        console.log(`Transaction sent! Hash: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`Registration successful in block ${receipt.blockNumber}!`);
        
        const profile = await registry.profile(wallet.address);
        console.log("Profile Status:", profile[0] ? "Active" : "Inactive");

    } catch (e) {
        console.error("Registration failed:", e.message);
        if (e.data) console.error("Error data:", e.data);
    }
}

main();
