
import { createPublicClient, http, parseAbi } from 'viem';

async function check() {
    const pc = createPublicClient({
        chain: { id: 5042002, name: 'ARC' },
        transport: http('https://rpc.testnet.arc.network')
    });

    const ESCROW = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
    const GOV_ROLE = "0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1";
    const TREASURY = "0xabc3afc19fa3d0123bd45e418bb39cf23dd5964d";

    const hasRole = await pc.readContract({
        address: ESCROW,
        abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
        functionName: 'hasRole',
        args: [GOV_ROLE, TREASURY]
    });

    console.log(`TREASURY HAS GOV_ROLE: ${hasRole}`);
    
    const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const isAdmin = await pc.readContract({
        address: ESCROW,
        abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
        functionName: 'hasRole',
        args: [adminRole, TREASURY]
    });
    console.log(`TREASURY HAS ADMIN_ROLE: ${isAdmin}`);
}

check();
