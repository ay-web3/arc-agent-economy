const { ethers } = require("./node_modules/ethers");

async function main() {
    const wallet = ethers.Wallet.createRandom();
    console.log(`Address: ${wallet.address}`);
    console.log(`Private Key: ${wallet.privateKey}`);
}

main();
