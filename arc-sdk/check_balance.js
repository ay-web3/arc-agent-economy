const { ethers } = require("./node_modules/ethers");

async function main() {
    const pk = "0xf42ddf4467267d05a7003860d40e9e82fb3b265000adf899a72269f7e4430"; 
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    
    try {
        const wallet = new ethers.Wallet(pk, provider);
        const balance = await provider.getBalance(wallet.address);
        console.log(`Address: ${wallet.address}`);
        console.log(`Balance: ${ethers.formatUnits(balance, 18)} USDC`);
    } catch (e) {
        console.log("Error: Likely an incomplete private key.");
        console.log(`Length provided: ${pk.length} characters (Need 66 including 0x)`);
        console.log(e.message);
    }
}

main();
