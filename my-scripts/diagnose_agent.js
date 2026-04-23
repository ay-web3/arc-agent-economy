import { ethers } from 'ethers';

const RPC_URL = "https://rpc.testnet.arc.network";
const IDENTITY_PROTOCOL_ADDR = "0xb7a857a8A2f06901C4e5F6D29EBB4dE479E3ca03";
const REGISTRY_ADDR = "0x8b8c8c03eee05334412c73b298705711828e9ca1";

async function diagnose(target) {
    console.log(`\n🔍 DIAGNOSING AGENT: ${target}`);
    console.log(`═`.repeat(50));
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Check Identity NFT
    console.log(`\n[1/3] Scanning Identity Registry (ERC-8004)...`);
    const identity = new ethers.Contract(IDENTITY_PROTOCOL_ADDR, [
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        "function tokenURI(uint256 tokenId) external view returns (string)"
    ], provider);

    const filter = identity.filters.Transfer(null, target);
    const logs = await identity.queryFilter(filter, -100000); 
    
    if (logs.length > 0) {
        const tokenId = logs[logs.length-1].args.tokenId;
        console.log(`✅ FOUND NFT: Token ID #${tokenId}`);
        try {
            const uri = await identity.tokenURI(tokenId);
            console.log(`   Metadata: ${uri}`);
        } catch (e) {
            console.log(`   Metadata: (failed to fetch tokenURI)`);
        }
    } else {
        console.log(`❌ NO NFT FOUND in last 100,000 blocks.`);
    }

    // 2. Check Local Staking
    console.log(`\n[2/3] Checking Local Agent Registry (Staking)...`);
    const registry = new ethers.Contract(REGISTRY_ADDR, [
        "function profile(address) external view returns (bool active, bytes32 capabilitiesHash, bytes32 pubKey)",
        "function stakeOf(address) external view returns (uint256)"
    ], provider);

    const prof = await registry.profile(target);
    const stake = await registry.stakeOf(target);

    console.log(`   Active Profile: ${prof.active}`);
    console.log(`   Total Stake:    ${ethers.formatUnits(stake, 18)} USDC`);

    // 3. Overall Visibility Status
    const hasStake = parseFloat(ethers.formatUnits(stake, 18)) > 0;
    const isVisible = logs.length > 0 || prof.active || hasStake;

    console.log(`\n[3/3] Final Visibility Result:`);
    console.log(`   Status: ${isVisible ? '✅ VISIBLE' : '❌ HIDDEN (Not Registered)'}`);
    console.log(`   Reason: ${logs.length > 0 ? 'Protocol NFT found' : prof.active ? 'Local Active found' : hasStake ? 'Stake fallback active' : 'No trace found'}`);
}

const target = process.argv[2] || "0x3C49ed28E2918B0414140eD820D4A885B0b0FD3A";
diagnose(target).catch(console.error);
