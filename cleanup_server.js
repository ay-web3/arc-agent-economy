const fs = require('fs');

let lines = fs.readFileSync('server.mjs', 'utf8').split('\n');

// Helper to remove lines between two substring matches
function removeBlock(startStr, endStr) {
    const start = lines.findIndex(l => l.includes(startStr));
    const end = lines.findIndex(l => l.includes(endStr));
    if (start !== -1 && end !== -1 && end >= start) {
        console.log(Removing from \ to \ (lines \-\));
        lines.splice(start, end - start);
    }
}

// 1. Remove escrow, identity endpoints
removeBlock("app.post('/escrow/create-task'", "app.post('/onboard'");

// 2. Remove /nano/authorize to /agent/sign-402
removeBlock("app.post('/nano/authorize'", "app.post('/agent/sign-402'");

// 3. Remove /execute/:action block
removeBlock("app.post('/execute/:action'", "app.get('/tx-status/:id'");

// 4. Remove REGISTRY_CA and ESCROW_CA from SwarmOrchestrator config
lines = lines.filter(l => !l.includes('registryAddress: process.env.REGISTRY_CA') && !l.includes('escrowAddress: process.env.ESCROW_CA'));

fs.writeFileSync('server.mjs', lines.join('\n'));
console.log('Cleanup complete!');
