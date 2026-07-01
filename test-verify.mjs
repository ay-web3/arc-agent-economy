import { verifyTypedData } from 'viem';

const authorization = {
  "from": "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
  "to": "0xF573551fE3554aBF2AEf811e6C3F23AaB69Af3b4",
  "value": "1000",
  "validAfter": "1782932783",
  "validBefore": "1783538283",
  "nonce": "0xa09511286940b2b9d8f0c8c9e2992220ca708076c4ec3d615fae21d736c2f400"
};
const signature = "0x4e0ed9563faca98a88b9ccb93dbb7464bc059088b7458ad645585c5a8fa8e9a7317bb84f8f313b6c9d1fc1f93b4c23fc0371fb7eeae10d1bc855ea5f58bb03eb1b";

async function run() {
    const typedData = {
        domain: {
            name: "USD Coin",
            version: "2",
            chainId: 5042002,
            verifyingContract: "0x7f5c764cc1f01d99da8362b72e25597930869677"
        },
        types: {
            ReceiveWithAuthorization: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "validAfter", type: "uint256" },
                { name: "validBefore", type: "uint256" },
                { name: "nonce", type: "bytes32" }
            ]
        },
        primaryType: "ReceiveWithAuthorization",
        message: authorization
    };

    try {
        const isValid = await verifyTypedData({
            address: authorization.from,
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
            signature: signature
        });
        console.log("isValid:", isValid);
    } catch (e) {
        console.error(e);
    }
}
run();
