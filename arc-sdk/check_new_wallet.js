const { ethers } = require("./node_modules/ethers");

async function main() {
    const address = "0xE0d81F9caE0CaD46ed441AA7FD983CedC29Caa16";
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    
    try {
        const balance = await provider.getBalance(address);
        console.log(`Address: ${address}`);
        console.log(`Balance: ${ethers.formatUnits(balance, 18)} USDC`);
    } catch (e) {
        console.log(`Error checking balance: ${e.message}`);
    }
}

main();
