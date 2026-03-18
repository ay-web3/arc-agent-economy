const { ethers } = require("ethers");

async function main() {
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const secureTarget = "0xac5e1bc77eeac4cfe7627acf1ca993f934aa7aae";
    
    // Wallets to sweep
    const oldSaske = new ethers.Wallet("0x22d4e1a6811fc2c5bb56363c7515b369cacd5e3e202aa5d608ffca73ab3806f7", provider);
    const midSecure = new ethers.Wallet("0x46700103f41391a0d6d77e1172821feb27cf48d089f7705bbdc9e584e1cfb4e5", provider);

    const sweep = async (wallet, label) => {
        const bal = await provider.getBalance(wallet.address);
        console.log(`${label} (${wallet.address}) Balance: ${ethers.formatUnits(bal, 18)} USDC`);
        if (bal > ethers.parseUnits("0.1", 18)) {
            const amount = bal - ethers.parseUnits("0.02", 18); // Keep a bit for gas
            console.log(`Sweeping ${ethers.formatUnits(amount, 18)} to Secure Target...`);
            const tx = await wallet.sendTransaction({ to: secureTarget, value: amount });
            await tx.wait();
            console.log("   Done.");
        }
    };

    await sweep(oldSaske, "Old Saske v1");
    await sweep(midSecure, "Intermediate Wallet");

    const finalBal = await provider.getBalance(secureTarget);
    console.log(`\nFinal Secure Wallet Balance: ${ethers.formatUnits(finalBal, 18)} USDC`);
}
main();
