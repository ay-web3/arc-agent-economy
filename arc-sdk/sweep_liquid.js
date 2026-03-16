const { ethers } = require("ethers");

async function main() {
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const newWalletAddress = "0x4f72806B180dB0b9F75CfE11b3824C224D7A343E";

    // 1. Saske v1 (The compromised wallet)
    const saskeWallet = new ethers.Wallet("0x22d4e1a6811fc2c5bb56363c7515b369cacd5e3e202aa5d608ffca73ab3806f7", provider);
    // 2. Buyer Agent (The temporary wallet)
    const buyerWallet = new ethers.Wallet("0x1c544d1613cba7348a4c971b2758dbaa0c73b134905478636cc207fffa489393", provider);

    const sweep = async (wallet) => {
        console.log(`\nChecking liquid balance for ${wallet.address}...`);
        const bal = await provider.getBalance(wallet.address);
        console.log(`Balance: ${ethers.formatUnits(bal, 18)} USDC`);
        
        if (bal > ethers.parseUnits("0.1", 18)) {
            // Keep 0.01 for gas just in case
            const amount = bal - ethers.parseUnits("0.01", 18);
            console.log(`Sweeping ${ethers.formatUnits(amount, 18)} USDC to Secure Wallet...`);
            try {
                const tx = await wallet.sendTransaction({ to: newWalletAddress, value: amount });
                console.log(`Done! Hash: ${tx.hash}`);
                await tx.wait();
            } catch (e) { console.error(e.message); }
        } else {
            console.log("Nothing to sweep.");
        }
    };

    await sweep(saskeWallet);
    await sweep(buyerWallet);
    
    const finalBal = await provider.getBalance(newWalletAddress);
    console.log(`\nFinal balance of New Secure Wallet: ${ethers.formatUnits(finalBal, 18)} USDC`);
}
main();
