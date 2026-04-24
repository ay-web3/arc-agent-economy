
import { createPublicClient, http, parseAbi } from 'viem';

async function check() {
    const pc = createPublicClient({
        chain: { id: 5042002, name: 'ARC' },
        transport: http('https://rpc.testnet.arc.network')
    });

    const ESCROW = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
    const GOV_ROLE = "0x718093de3564e4511528c2a833777f7a8dc58849646487e4125b29f795656645";
    const TREASURY = "0x401FaF90c2b08c88914B630BFbcAF4b10CE1965D";

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
