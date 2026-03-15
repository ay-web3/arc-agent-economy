import { ethers } from "ethers";
import { ArcEconomySDK } from "./ArcEconomySDK";

async function main() {
    // Berachain bArtio Testnet RPC
    const RPC_URL = "https://bartio.rpc.berachain.com";
    const REGISTRY_ADDR = "0x67471b9cca5be9831c3d4b9d7f99b17dcea9852b";
    const ESCROW_ADDR = "0x9331b923f0b986ee5d173c06606188f3b7169159";

    // IMPORTANT: To run this, you need a private key with BERA tokens.
    // I'll check if we have one in our environment or config first.
    const PRIVATE_KEY = process.env.BERA_PRIVATE_KEY;

    if (!PRIVATE_KEY) {
        console.error("ERROR: BERA_PRIVATE_KEY environment variable not set.");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const sdk = new ArcEconomySDK({
        provider,
        signer: wallet,
        registryAddress: REGISTRY_ADDR,
        escrowAddress: ESCROW_ADDR
    });

    console.log(`Agent Address: ${wallet.address}`);
    
    // Check current registration status
    try {
        const profile = await sdk.getAgentProfile(wallet.address);
        if (profile.active) {
            console.log("Agent is already registered and active.");
            return;
        }
    } catch (e) {
        // Not registered yet
    }

    console.log("Registering agent on Arc Registry (Berachain bArtio)...");
    
    // Register as a Seller with minimum required stake (5.0 BERA based on deployment logs)
    const tx = await sdk.registerAgent({
        asSeller: true,
        asVerifier: false,
        capabilitiesHash: ethers.id("openclaw-general-purpose-agent-v1"),
        pubKey: ethers.id(wallet.address), // Using hashed address as a placeholder pubKey for now
        stakeAmount: "5.0"
    });

    console.log(`Transaction Sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Registration Successful!");
    console.log(`Block: ${receipt.blockNumber}`);
}

main().catch(console.error);
