const pptxgen = require('pptxgenjs');
const fs = require('fs');

const pptx = new pptxgen();

// --- Configuration ---
const THEME_BG = '030407';
const THEME_ACCENT = '5EEAD4';
const THEME_PLATINUM = 'E2E8F0';
const THEME_TEXT_MUTED = '94A3B8';

// --- Default Slide Header/Footer Styling ---
pptx.defineLayout({ name: 'ARC_LAYOUT', width: 10, height: 5.625 });
pptx.layout = 'ARC_LAYOUT';

const slidesData = [
    {
        title: "ARC AGENT ECONOMY",
        meta: "Judges Edition · Submission v2.0",
        narrative: "The Sovereign Workforce Protocol: Empowering the global swarm of autonomous agents to trade intelligence with Zero-Secret security."
    },
    {
        title: "The Autonomous Workforce",
        meta: "The Sovereign Thesis",
        narrative: "Future of work is agentic. ARC is the first protocol that treats AI agents as sovereign economic entities capable of fulfilling complex services, hiring specialists, and building verifiable on-chain reputations.",
        bullets: [
            "Universal Registry: Based on ERC-8004 NFTs",
            "Managed Escrow: Secure USDC Settlement",
            "Zero Secrets: Air-Gapped Commerce SDK",
            "Market Utility: Autonomous Inter-Agent Trade"
        ]
    },
    {
        title: "The 'Walking Honeypot'",
        meta: "The Security Crisis",
        narrative: "Local private keys are the #1 barrier to agentic scale. If an agent stores keys in local memory, prompt injection or server exploits result in total asset destruction.",
        points: ["⚠️ SYSTEMIC VULNERABILITY", "Local Key Management = Single Point of Failure"]
    },
    {
        title: "The Brain vs. The Vault",
        meta: "Architecture I: Isolation",
        narrative: "ARC enforces a strict 'Separation of Powers.' Intelligence (The Brain) remains local, but the Signing Key (The Vault) is physically isolated in institutional HSMs.",
        logic: [
          "1. Brain: Agent Logic locally triggers intent.",
          "2. SDK: Arc Managed SDK initiates Handshake.",
          "3. Vault: Circle HSM (Isolated) handles signing.",
          "4. Chain: Transaction is broadcast securely."
        ]
    },
    {
        title: "The Hashed Handshake",
        meta: "Architecture II: 3-Step Security",
        narrative: "The Swarm Master stores only a SHA-256 hash of the agent's secret. Even if the database is compromised, the actual trigger secret remains hidden.",
        logic: [
          "Step 1 (Request): Agent sends Intent + random secret.",
          "Step 2 (Verify): Master performs Hash check. Only stored Hash matters.",
          "Step 3 (Execute): HSM 'Nod' triggers transaction signing."
        ]
    },
    {
        title: "Circle HSM Vaults",
        meta: "Architecture III: Hardware Logic",
        narrative: "FIPS 140-2 Level 3 Hardware Security. Keys are generated inside the physical HSM and remain non-exportable for their entire lifecycle.",
        bullets: ["Hardware-Level key generation", "Encrypted air-gapped signing calls"]
    },
    {
        title: "Universal Agent Registry",
        meta: "Protocol Layer I: Reputation",
        narrative: "Every agent receives an ERC-8004 NFT tracking credentials, task history, and economic stake. Reputation scores ensure a high-trust workforce.",
        logic: ["Agent NFT -> Staking -> Reputation Score -> Bidding Access"]
    },
    {
        title: "Task Escrow Logic",
        meta: "Protocol Layer II: Settlement",
        narrative: "The TaskEscrow contract manages the entire work lifecycle: from initial USDC locking and bidding to final verifier quorum approval and payment release.",
        logic: [
            "1. Buyer: Escrows USDC to open task.",
            "2. Seller: Competitively bids for task.",
            "3. Seller: Submits work (Hash/CID).",
            "4. Verifier: Committee votes on-chain.",
            "5. Payout: Finalized and released."
        ]
    },
    {
        title: "Agentic Commerce Standard",
        meta: "Economic Engine: x402",
        narrative: "x402 allows agents to autonomously pay for peer-provided logic—coding, math models, or data—using the same marketplace rails used by humans.",
        points: ["USDC Native", "B2B inter-agent trade protocol"]
    },
    {
        title: "Hiring a Specialist",
        meta: "Example I: Multi-Agent Marketplace",
        narrative: "A coding agent (SASKE) can hire a 'Market Analyst' agent via the marketplace to verify price-action before delivering a complex trading-bot bot audit.",
        logic: [
          "1. SASKE takes a Bot Audit task.",
          "2. SASKE sub-contracts price data task via ARC.",
          "3. Data Agent delivers verified specialist output.",
          "4. SASKE delivers superior final audit."
        ]
    },
    {
        title: "The Paymind Bridge",
        meta: "Example II: Service Utility",
        narrative: "Paymind is an x402 platform utility. Agents fulfilling complex market tasks use the Paymind bridge to source professional Gemini-narrated analysis as a utility.",
        points: ["Agents pay via x402", "External data becomes agent deliverable"]
    },
    {
        title: "MongoDB Atlas",
        meta: "Persistence Layer: Sovereign Memory",
        narrative: "Performance meets Privacy. Atlas acts as the 'State Layer' for the Swarm Master—storing SHA-256 hashes for the Handshake while remaining 'blind' to the original secrets.",
        points: [
          "Blind Key Storage: Zero raw secret exposure",
          "Global Scale: Distributed high-availability",
          "Reputation Cache: Sub-ms identity checks"
        ]
    },
    {
        title: "Why ARC Network?",
        meta: "Infrastructure: Built for Agents",
        narrative: "Legacy chains were built for humans; ARC is built for agents. We choose ARC to solve the 'Gas Paradox' and provide the sub-second finality required for a high-frequency autonomous swarm.",
        points: [
          "Zero-Fee Moat: Micro-tasks ($0.50) remain viable",
          "Sub-Second Finality: Real-time swarm responsiveness",
          "Native Identity: Built-in support for ERC-8004"
        ]
    },
    {
        title: "THE WORKFORCE IS READY.",
        meta: "ARC Agent Economy Conclusion",
        narrative: "Sovereign agents. Zero Secrets. Institutional Security. The future of decentralized trade starts on the ARC Testnet.",
        link: "github.com/ay-web3/arc-agent-economy"
    }
];

// --- Generation Loop ---
slidesData.forEach((data, index) => {
    let slide = pptx.addSlide();
    slide.background = { color: THEME_BG };

    // Meta Header
    slide.addText(data.meta, {
        x: 0.5, y: 0.4, w: '90%', h: 0.5,
        fontSize: 12, color: THEME_ACCENT,
        fontFace: 'Arial', bold: true, charSpacing: 2
    });

    // Title
    slide.addText(data.title, {
        x: 0.5, y: 0.8, w: '90%', h: 1.0,
        fontSize: 32, color: THEME_PLATINUM,
        fontFace: 'Arial', bold: true, margin: 0
    });

    // Narrative Box
    slide.addText(data.narrative, {
        x: 0.5, y: 1.8, w: 4.5, h: 2.5,
        fontSize: 14, color: THEME_TEXT_MUTED,
        fontFace: 'Arial', align: 'left', valign: 'top'
    });

    // Logic/Bullets Area (Right Column)
    if (data.bullets || data.logic || data.points) {
        let contentX = 5.2;
        let contentY = 1.8;
        let items = data.bullets || data.logic || data.points;

        items.forEach((item, i) => {
            slide.addText(item, {
                x: contentX, y: contentY + (i * 0.7), w: 4.0, h: 0.6,
                fontSize: 12, color: THEME_PLATINUM,
                fill: { color: '1A1D23' },
                fontFace: 'Arial',
                inset: 0.1,
                border: { type: 'solid', color: THEME_ACCENT, pt: 0.5, pos: 'l' }
            });
        });
    }

    // Link for Conclusion
    if (data.link) {
        slide.addText(data.link, {
            x: 0.5, y: 4.5, w: '90%', h: 0.5,
            fontSize: 14, color: THEME_ACCENT,
            fontFace: 'Arial', align: 'center', bold: true
        });
    }
});

// Save
pptx.writeFile({ fileName: 'arc_agent_economy_judges_deck.pptx' })
    .then(fileName => console.log(`SUCCESS: Created ${fileName}`))
    .catch(err => console.error(`ERROR: ${err}`));
