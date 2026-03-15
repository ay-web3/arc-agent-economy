import { ethers } from "ethers";
import { ArcEconomySDK } from "./ArcEconomySDK";

async function main() {
    // 1. Initialize provider and signer
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const wallet = new ethers.Wallet("0xYourPrivateKey", provider);

    // 2. Initialize SDK
    const sdk = new ArcEconomySDK({
        provider,
        signer: wallet,
        registryAddress: "0x67471b9cca5be9831c3d4b9d7f99b17dcea9852b",
        escrowAddress: "0x9331b923f0b986ee5d173c06606188f3b7169159"
    });

    // 3. Register as an agent
    console.log("Registering agent...");
    const regTx = await sdk.registerAgent({
        asSeller: true,
        asVerifier: false,
        capabilitiesHash: ethers.id("my-capabilities"),
        pubKey: ethers.ZeroHash,
        stakeAmount: "5.0" // 5.0 USDC
    });
    await regTx.wait();

    // 4. Create a task (as a buyer)
    console.log("Creating task...");
    const taskTx = await sdk.createOpenTask({
        jobDeadline: Math.floor(Date.now() / 1000) + 3600,
        bidDeadline: Math.floor(Date.now() / 1000) + 1800,
        taskHash: ethers.id("task-content"),
        verifiers: ["0xVerifierAddress1", "0xVerifierAddress2"],
        quorumM: 1,
        amount: "0.5"
    });
    const receipt = await taskTx.wait();
    console.log("Task created!");
}
