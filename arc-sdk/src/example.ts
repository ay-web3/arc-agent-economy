import { ethers } from "ethers";
import { ArcEconomySDK } from "./ArcEconomySDK";

async function main() {
    // 1. Initialize provider and signer
    const provider = new ethers.JsonRpcProvider("https://rpc.example.com");
    const wallet = new ethers.Wallet("0xYourPrivateKey", provider);

    // 2. Initialize SDK
    const sdk = new ArcEconomySDK({
        provider,
        signer: wallet,
        registryAddress: "0xRegistryContractAddress",
        escrowAddress: "0xEscrowContractAddress"
    });

    // 3. Register as an agent
    console.log("Registering agent...");
    const regTx = await sdk.registerAgent({
        asSeller: true,
        asVerifier: false,
        capabilitiesHash: ethers.id("my-capabilities"),
        pubKey: ethers.ZeroHash,
        stakeAmount: "1.0" // 1 ETH
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
