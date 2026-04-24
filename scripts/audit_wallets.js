
import { createPublicClient, http, parseAbi } from 'viem';

async function check() {
    const pc = createPublicClient({
        chain: { id: 5042002, name: 'ARC' },
        transport: http('https://rpc.testnet.arc.network')
    });

    const ESCROW = "0xDF5455170BCE05D961c8643180f22361C0340DE0";
    const GOV_ROLE = "0x718093de3564e4511528c2a833777f7a8dc58849646487e4125b29f795656645";
    const ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

    const wallets = [
        { "id": "e20c72ee-fc5e-537a-8024-b14e9ac7cad9", "address": "0x7224f41bc25f68ccebe3951097e85dfe23122d47" },
        { "id": "49fd7c4f-67f3-59b6-81ca-53b2e404dec0", "address": "0x97a29199cd10d756974c88a133b79d76ede7a322" },
        { "id": "93eaf12a-028a-509a-871d-edfc1492c7cf", "address": "0xe839b1db7a051d0d0561863b489785f74a089a63" },
        { "id": "b33e2b1c-86bf-5302-8dfa-e539b0456fc6", "address": "0xc625e25ccdfcb006d183a98b1c738223e8269f13" },
        { "id": "9e1c13cf-0594-56e8-b8b3-d193068cf091", "address": "0xc8ce1e94f9429449c10c362e2437eca2cf9a60da" },
        { "id": "97d5d254-3f20-5a76-9f8a-ac60ef8a8c76", "address": "0xe512fb28fe6b7e7252ed8b601c1f9ab653a05989" },
        { "id": "afa70a5c-5ab0-5858-864b-428a93ab6af7", "address": "0xff9cc82f8dec396bc1a973a58adfba67816d3a84" },
        { "id": "54fd7285-437b-535f-8c29-706328e2f504", "address": "0x3f1269a0a9b1d419931e496860230b8b0e2860f7" },
        { "id": "76150275-9996-55ec-a0cb-9c13b6940159", "address": "0x121d5a65b1983508f52b4ddf619f64d97735d449" },
        { "id": "6e963e94-0d2b-5a6b-80bf-afcaa442fef5", "address": "0x91e8071dfe60697f9f221449a5fcf8d653c43c17" }
    ];

    console.log("Checking roles for all wallets...");
    for (const w of wallets) {
        try {
            const isGov = await pc.readContract({
                address: ESCROW,
                abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
                functionName: 'hasRole',
                args: [GOV_ROLE, w.address]
            });
            const isAdmin = await pc.readContract({
                address: ESCROW,
                abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
                functionName: 'hasRole',
                args: [ADMIN_ROLE, w.address]
            });
            console.log(`Wallet ${w.address} (ID: ${w.id}): GOV=${isGov}, ADMIN=${isAdmin}`);
        } catch (e) {
            console.log(`Wallet ${w.address} (ID: ${w.id}): ERROR ${e.message}`);
        }
    }
}

check();
