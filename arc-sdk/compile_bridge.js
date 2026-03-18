const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.resolve(__dirname, '../contracts', 'ArcArgentBridge.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'ArcArgentBridge.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode'],
            },
        },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach((err) => {
        console.error(err.formattedMessage);
    });
}

const contract = output.contracts['ArcArgentBridge.sol']['ArcArgentBridge'];

fs.writeFileSync(
    path.resolve(__dirname, 'ArcArgentBridge.json'),
    JSON.stringify({
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object,
    }, null, 2)
);

console.log('Compilation successful. Created ArcArgentBridge.json');
