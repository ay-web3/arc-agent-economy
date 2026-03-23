require('dotenv').config();
const axios = require('axios');
const forge = require('node-forge');
const { v4: uuidv4 } = require('uuid');
const { ethers } = require('ethers');

const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;

async function getCiphertext() {
    const pubResponse = await axios.get('https://api.circle.com/v1/w3s/config/entity/publicKey', {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const publicKey = forge.pki.publicKeyFromPem(pubResponse.data.data.publicKey);
    const encrypted = publicKey.encrypt(forge.util.hexToBytes(ENTITY_SECRET), 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: { md: forge.md.sha256.create() }
    });
    return forge.util.encode64(encrypted);
}

async function main() {
    const ciphertext = await getCiphertext();
    const REGISTRY_CA = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
    
    // Using the Developer-Controlled Master Wallet ID to send the admin tx
    const payload = {
        idempotencyKey: uuidv4(),
        entitySecretCiphertext: ciphertext,
        walletId: process.env.MASTER_WALLET_ID, 
        blockchain: "ARC-TESTNET",
        feeLevel: "MEDIUM",
        contractAddress: REGISTRY_CA,
        abiFunctionSignature: "setMinStakes(uint256,uint256)",
        abiParameters: [
            ethers.parseUnits("50.0", 18).toString(),
            ethers.parseUnits("50.0", 18).toString()
        ]
    };

    console.log("Requesting Staking Restoration to 50.0 USDC via Circle...");
    const response = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', payload, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    });
    console.log("Success! Circle Tx ID:", response.data.data.id);
}

main().catch(e => console.error(e.response ? e.response.data : e.message));
