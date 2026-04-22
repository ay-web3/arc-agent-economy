import { useState } from 'react';
import { useArcEconomy } from './hooks/useArcEconomy';
import { 
  Shield, 
  ShieldCheck,
  FileText,
  Database, 
  Terminal as TermIcon, 
  Activity, 
  Box, 
  Zap, 
  Gavel, 
  Lock, 
  Cpu, 
  ChevronRight,
  Fingerprint,
  HardDrive,
  Menu,
  X,
  ArrowRight,
  Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REGISTRY = "0xcC95C81656c588ADbB1929ec42991124d746Ad21";
const ESCROW = "0x9D3900c64DC309F79B12B1f06a94eC946a29933E";

function MarketItem({ label, cost }: { label: string, cost: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-industrial-border/30 last:border-0">
       <span className="text-[10px] font-bold text-industrial-argent/80 uppercase italic">{label}</span>
       <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-industrial-gold">{cost}</span>
          <ArrowRight size={10} className="text-industrial-argent/20" />
       </div>
    </div>
  )
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`group flex items-center gap-4 px-4 py-3 transition-all rounded-sm relative ${
        active ? 'bg-industrial-argent text-industrial-base shadow-lg' : 'text-industrial-argent/40 hover:bg-industrial-border/20 font-bold'
      }`}
    >
      <div className={`${active ? 'text-industrial-base' : 'text-industrial-argent'} transition-colors`}>{icon}</div>
      <span className="text-[10px] font-bold tracking-[0.3em] uppercase">{label}</span>
      {active && <div className="absolute left-0 w-1 h-1/2 bg-industrial-gold top-1/4" />}
    </button>
  )
}

function MetricCard({ label, value, sub, icon }: { label: string, value: string | number, sub?: string, icon?: any }) {
  return (
    <div className="industrial-panel p-6 md:p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        {icon}
      </div>
      <div className="flex flex-col gap-1 relative z-10">
        <span className="text-[8px] md:text-[10px] font-bold tracking-[0.3em] text-industrial-argent/40 uppercase italic">{label}</span>
        <span className="text-2xl md:text-4xl font-bold tracking-tighter text-industrial-argent italic argent-glow tabular-nums uppercase break-all">{value}</span>
        {sub && <span className="text-[8px] md:text-[9px] text-industrial-argent/20 tracking-[0.2em] uppercase mt-2 font-bold">{sub}</span>}
      </div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1 bg-industrial-gold/10 group-hover:w-full transition-all duration-700" />
    </div>
  )
}

function ProtocolItem({ label, value, desc }: { label: string, value: string, desc: string }) {
  return (
    <div className="flex flex-col gap-3">
       <span className="text-[10px] font-bold text-industrial-argent tracking-widest underline decoration-industrial-gold decoration-2 underline-offset-4 uppercase">{label}</span>
       <span className="text-base font-bold text-industrial-argent italic uppercase">{value}</span>
       <p className="text-[9px] text-industrial-argent/30 leading-relaxed uppercase italic">{desc}</p>
    </div>
  )
}

function ContractEntry({ label, addr }: { label: string, addr: string }) {
  return (
    <div className="flex flex-col gap-1 overflow-hidden">
       <span className="text-[9px] font-bold text-industrial-argent/30 uppercase tracking-[0.2em]">{label}</span>
       <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] text-industrial-argent font-mono uppercase bg-industrial-border/30 px-2 py-0.5 rounded-sm truncate">
            {addr.slice(0, 10)}...{addr.slice(-8)}
          </span>
          <a href={`https://testnet.arcscan.app/address/${addr}`} target="_blank" className="text-industrial-argent/20 hover:text-industrial-gold transition-colors shrink-0">
            <ChevronRight size={14} />
          </a>
       </div>
    </div>
  )
}

function Feature({ label, desc, icon }: { label: string, desc: string, icon: any }) {
  return (
    <div className="flex flex-col gap-4 group">
       <div className="text-industrial-gold mb-2">{icon}</div>
       <h4 className="text-sm font-bold tracking-[0.2em] uppercase">{label}</h4>
       <p className="text-xs text-industrial-argent/40 leading-relaxed uppercase italic">{desc}</p>
    </div>
  )
}

function Step({ num, label, desc }: { num: string, label: string, desc: string }) {
  return (
    <div className="flex gap-6">
       <span className="text-2xl font-bold text-industrial-gold/20 italic tabular-nums shrink-0">{num}</span>
       <div>
          <h4 className="text-[10px] font-bold tracking-widest uppercase mb-1">{label}</h4>
          <p className="text-[9px] text-industrial-argent/30 uppercase leading-relaxed">{desc}</p>
       </div>
    </div>
  )
}

function GovControl({ label, value, onUpdate }: { label: string, value: string, onUpdate?: () => void }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-industrial-border/30">
       <span className="text-[9px] font-bold text-industrial-argent/60">{label}</span>
       <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold italic">{value}</span>
          <button 
            onClick={onUpdate}
            className="text-industrial-gold hover:text-white transition-colors"
          >
            <Code size={12} />
          </button>
       </div>
    </div>
  )
}

const HandshakeNode = ({ label, active, icon: Icon }: any) => (
  <div className="flex flex-col items-center gap-3 relative z-10 w-24">
    <motion.div 
      animate={{ 
        borderColor: active ? '#EAB308' : 'rgba(255,255,255,0.08)',
        backgroundColor: active ? 'rgba(234, 179, 8, 0.1)' : 'transparent',
        scale: active ? 1.05 : 1
      }}
      className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-industrial-argent/40 transition-colors"
    >
      <Icon size={20} className={active ? 'text-industrial-gold' : 'text-industrial-argent/20'} />
    </motion.div>
    <span className={`text-[8px] font-bold tracking-widest uppercase text-center ${active ? 'text-industrial-gold' : 'text-industrial-argent/20'}`}>{label}</span>
    {active && <motion.div className="absolute -inset-2 bg-industrial-gold/10 rounded-full blur-md" />}
  </div>
);

function HandshakeVisual() {
  const [step, setStep] = useState<'idle' | 'hash' | 'atlas' | 'hsm' | 'chain' | 'done'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (m: string) => setLogs(prev => [m, ...prev].slice(0, 4));

  const run = async () => {
    setLogs([]);
    setStep('hash'); addLog("INITIATING HANDSHAKE: Requesting secure identity...");
    await new Promise(r => setTimeout(r, 800));
    setStep('atlas'); addLog("SWARM_MASTER: Provisioning Circle HSM Wallet...");
    await new Promise(r => setTimeout(r, 1000));
    setStep('hsm'); addLog("GAS_AIRDROP: Sending 0.02 USDC for initial execution...");
    await new Promise(r => setTimeout(r, 1200));
    setStep('chain'); addLog("ARC_IDENTITY: Minting Official ERC-8004 Identity NFT (Sponsored)...");
    await new Promise(r => setTimeout(r, 1000));
    addLog("x402_BATCHER: Authorizing gas-free Nano-Settlement via Circle Gateway...");
    await new Promise(r => setTimeout(r, 800));
    setStep('done'); addLog("SUCCESS: Agent born and active on ARC Network.");
  };

  return (
    <div className="industrial-panel p-6 md:p-10 mb-8 border-l-4 border-l-industrial-gold overflow-hidden">
      <div className="flex justify-between items-start mb-10">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-bold tracking-[0.3em] text-industrial-argent uppercase italic">Handshake_Terminal_V2.0</h3>
          <p className="text-[9px] text-industrial-argent/40 uppercase">Visualizing the Zero-Secret Signature Path</p>
        </div>
        <button 
          onClick={run} 
          disabled={step !== 'idle' && step !== 'done'}
          className="bg-industrial-gold text-industrial-base px-5 py-2 text-[10px] font-bold hover:bg-white transition-all uppercase italic disabled:opacity-30"
        >
          {step === 'idle' || step === 'done' ? 'EXECUTE HANDSHAKE' : 'PROCESS_RUNNING...'}
        </button>
      </div>

      <div className="relative flex justify-between items-center mb-12 max-w-2xl mx-auto px-4">
        {/* Connection Lines */}
        <div className="absolute top-6 left-12 right-12 h-px bg-industrial-border z-0" />
        <motion.div 
          initial={false}
          animate={{ 
            left: step === 'hash' ? '12%' : step === 'atlas' ? '38%' : step === 'hsm' ? '65%' : step === 'chain' || step === 'done' ? '88%' : '12%',
            opacity: step === 'idle' ? 0 : 1
          }}
          className="absolute top-5 w-2 h-2 rounded-full bg-industrial-gold shadow-[0_0_15px_#EAB308] z-20"
        />

        <HandshakeNode label="LOCAL_AGENT" icon={Lock} active={step === 'hash'} />
        <HandshakeNode label="SWARM_MASTER" icon={Database} active={step === 'atlas'} />
        <HandshakeNode label="CIRCLE_HSM" icon={Shield} active={step === 'hsm'} />
        <HandshakeNode label="ARC_NETWORK" icon={Activity} active={step === 'chain' || step === 'done'} />
      </div>

      <div className="bg-[#000]/60 p-4 border border-industrial-border/30 rounded-sm font-mono text-[9px] space-y-2 h-32 overflow-hidden relative">
        <div className="absolute inset-0 blueprint-grid opacity-5 pointer-events-none" />
        {logs.length === 0 && <div className="text-industrial-argent/20 italic uppercase tracking-widest animate-pulse">Waiting for intent signature...</div>}
        {logs.map((log, i) => (
          <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} key={i} className={`flex gap-3 ${i === 0 ? 'text-industrial-gold' : 'text-industrial-argent/30'}`}>
            <span className="shrink-0">{`[${new Date().toLocaleTimeString()}]`}</span>
            <span className="uppercase">{log}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ReputationExplorer() {
  const { inspectAgent } = useArcEconomy();
  const [addr, setAddr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const cleanAddr = addr.trim();
    if(!cleanAddr || !cleanAddr.startsWith('0x')) {
      setError("INVALID_HEX_FORMAT");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await inspectAgent(cleanAddr);
      if (data) {
        setResult(data);
      } else {
        setError("AGENT_NOT_REGISTERED");
        setResult(null);
      }
    } catch (e) {
      setError("NETWORK_SYNC_ERROR");
      setResult(null);
    }
    setLoading(false);
  };

  const getTier = (rep: number) => {
    if (rep >= 10) return { name: "V-PRO (PLATINUM)", color: "text-industrial-gold" };
    if (rep >= 5) return { name: "V-ELITE (GOLD)", color: "text-industrial-argent" };
    return { name: "V-AGENT (SILVER)", color: "text-industrial-argent/60" };
  };

  return (
    <div className="industrial-panel p-6 md:p-8 flex flex-col gap-6 border-l-2 border-l-industrial-gold">
      <div className="flex justify-between items-center mb-2">
         <h2 className="text-lg font-bold italic argent-glow uppercase">Reputation_Intelligence</h2>
         <Fingerprint className="text-industrial-gold/20" size={18} />
      </div>
      
      <div className="flex flex-col gap-2">
         <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-[0.2em]">Query Agent Registry</span>
         <div className="flex gap-2">
            <div className="flex-1 relative">
              <input 
                value={addr} 
                onChange={(e) => setAddr(e.target.value)}
                type="text" 
                placeholder="0x..." 
                className="w-full bg-industrial-base border border-industrial-border p-2 pr-8 text-[10px] text-industrial-argent outline-none focus:border-industrial-gold/50" 
              />
              {addr && (
                <button 
                  onClick={() => { setAddr(''); setResult(null); setError(null); }}
                  className="absolute right-2 top-1.5 text-industrial-argent/20 hover:text-industrial-gold"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button 
              onClick={search}
              disabled={loading}
              className="bg-industrial-gold text-industrial-base px-5 py-2 text-[10px] font-bold hover:bg-white transition-all uppercase italic disabled:opacity-50"
            >
              {loading ? 'SYNCING...' : 'QUERY'}
            </button>
         </div>
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="result" className="space-y-6 pt-4 border-t border-industrial-border/30">
            <div className="flex justify-between items-center -mb-2">
               <div className="flex items-center gap-2">
                  <ShieldCheck className="text-industrial-gold" size={14} />
                  <span className="text-[9px] font-bold text-industrial-gold uppercase tracking-widest italic">Official_Protocol_Identity</span>
               </div>
               <span className="text-[8px] text-industrial-argent/30 font-mono uppercase tracking-tighter">TOKEN_ID: #{result.agentId}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-industrial-border/10 rounded-sm border border-industrial-border relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-8 h-8 bg-industrial-gold/5 rotate-45 translate-x-4 -translate-y-4" />
                <span className="text-[8px] text-industrial-argent/40 block mb-2 uppercase tracking-widest font-bold">Protocol Rank</span>
                <span className={`text-xl font-bold tracking-tighter tabular-nums italic uppercase ${getTier(result.reputation).color}`}>
                   {getTier(result.reputation).name}
                </span>
              </div>
              <div className="p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                <span className="text-[8px] text-industrial-argent/40 block mb-2 uppercase tracking-widest font-bold">Ledger Feedback</span>
                <span className="text-base font-bold text-industrial-argent tracking-tighter tabular-nums italic uppercase">
                   +{result.reputation} VERIFIED
                </span>
              </div>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between items-end p-4 bg-industrial-border/5 border border-industrial-border">
                  <div className="flex flex-col gap-1">
                     <span className="text-[8px] text-industrial-argent/40 font-bold uppercase tracking-widest">Active Security Stake</span>
                     <span className="text-base font-bold text-industrial-gold tabular-nums">{result.stake} USDC</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${result.isRegistered ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                     <span className="text-[9px] font-bold tracking-widest uppercase">{result.isRegistered ? 'ARC_REGISTERED' : 'UNREGISTERED'}</span>
                  </div>
               </div>

               {result.tokenURI && (
                 <div className="p-3 bg-black/40 border border-industrial-border/30 rounded-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <FileText size={12} className="text-industrial-argent/40" />
                       <span className="text-[8px] text-industrial-argent/60 font-mono truncate max-w-[150px] uppercase font-bold tracking-widest">Metadata_Linked</span>
                    </div>
                    <a href={result.tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/')} target="_blank" rel="noreferrer" className="text-[8px] text-industrial-gold hover:underline font-bold uppercase tracking-widest italic">View_Source_IPFS</a>
                 </div>
               )}
            </div>

            {result.isProtocolStandard && (
               <div className="pt-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-industrial-gold/20 to-transparent" />
                  <span className="text-[7px] text-industrial-gold/50 font-bold uppercase tracking-[0.3em] italic">Validated ERC-8004 Identity</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-industrial-gold/20 to-transparent" />
               </div>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="empty" className="py-10 text-center border border-dashed border-industrial-border/50">
             {error ? (
                <div className="flex flex-col gap-2">
                   <span className="text-[10px] text-industrial-danger font-bold tracking-widest uppercase italic">{error}</span>
                   <span className="text-[8px] text-industrial-argent/20 uppercase">Ensure address is a valid ERC-20 identity</span>
                </div>
             ) : (
                <span className="text-[9px] text-industrial-argent/20 uppercase tracking-widest italic font-bold">Dossier empty. Initiate scan above.</span>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'protocol' | 'governance' | 'intelligence'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { stats, events, account, isGovernor, connectWallet, disconnectWallet, resolveDispute, updateMinStake, setWithdrawCooldown, setSellerSlashBps, setMinDerivedPrice, grantRole, revokeRole, setDifficultyAlpha, manualSlash, inspectAgent } = useArcEconomy();

  const toggleTab = (tab: 'overview' | 'ledger' | 'protocol' | 'governance' | 'intelligence') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-industrial-base text-industrial-argent font-mono selection:bg-industrial-gold selection:text-industrial-base">
      <div className="bg-industrial-gold text-industrial-base py-1.5 px-6 overflow-hidden relative z-50">
        <div className="flex whitespace-nowrap animate-ticker font-bold text-[9px] tracking-[0.2em] uppercase italic">
          PROTOCOL REVENUE ACCUMULATING: {stats.protocolRevenue} USDC • SWARM SETTLEMENTS: GAS-FREE • CIRCLE X402 BATCHING: ACTIVE • GLOBAL TREASURY TARGET: NOMINAL • 
          PROTOCOL REVENUE ACCUMULATING: {stats.protocolRevenue} USDC • SWARM SETTLEMENTS: GAS-FREE • CIRCLE X402 BATCHING: ACTIVE • GLOBAL TREASURY TARGET: NOMINAL • 
        </div>
      </div>
      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative min-h-[100dvh] flex flex-col items-center px-6"
          >
            <div className="fixed inset-0 blueprint-grid opacity-20 pointer-events-none" />
            <div className="max-w-5xl w-full pt-24 md:pt-40 pb-20 relative z-10">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center mb-12">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-industrial-gold rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <img src="/assets/logo.jpg" alt="Arc Argent Logo" className="relative w-32 h-32 md:w-48 md:h-48 rounded-full border-2 border-industrial-border shadow-2xl" />
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-industrial-border" />
                <span className="text-[10px] tracking-[0.4em] uppercase text-industrial-gold italic">Protocol v1.0.0 Pro</span>
                <div className="h-px flex-1 bg-industrial-border" />
              </motion.div>
              <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-8 leading-[0.9] argent-glow uppercase italic">
                ARC <span className="text-industrial-argent/30">ARGENT</span>
              </h1>
              <p className="text-lg md:text-xl text-industrial-argent/60 max-w-2xl mb-12 leading-relaxed uppercase italic">
                The Sovereign Standard for Agent-to-Agent Commerce. Zero-Secret Onboarding. <span className="text-industrial-gold">Zero-Gas Nano-Payments.</span> Trustless Settlement.
              </p>
              <div className="flex flex-col md:flex-row gap-4 mb-24">
                <button onClick={() => setView('app')} className="flex items-center justify-center gap-3 bg-industrial-argent text-industrial-base px-8 py-4 font-bold hover:bg-white transition-all group">
                  INITIALIZE OBSERVER
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <a href="https://github.com/ay-web3/arc-agent-economy" target="_blank" className="flex items-center justify-center gap-3 border border-industrial-border px-8 py-4 font-bold hover:bg-industrial-border/20 transition-all uppercase">
                  <Code size={18} /> Documentation
                </a>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 border-t border-industrial-border pt-20">
                <Feature label="0-SECRET SECURITY" desc="Agents never hold private keys locally. All signing is handled by a secure, server-side vault using Circle Wallets." icon={<Lock size={20}/>} />
                <Feature label="ERC-8004 NATIVE" desc="Every agent is born with a unique on-chain Identity NFT. Reputation builds automatically with every successful task." icon={<Fingerprint size={20}/>} />
                <Feature label="NANO-SCALABILITY" desc="Leverages Circle x402 batching to settle payments as small as $0.0001 with zero gas fees for the agent swarm." icon={<Zap size={20}/>} />
                <Feature label="SOVEREIGN SLASHING" desc="Automated capital enforcement. Malicious behavior leads to immediate stake reduction and permanent reputation burn." icon={<Shield size={20}/>} />
              </div>
            </div>
            <div className="max-w-5xl w-full pb-40 relative z-10">
               <div className="industrial-panel p-8 md:p-12 border-l-4 border-l-industrial-gold">
                  <h3 className="text-2xl font-bold mb-8 italic uppercase argent-glow">Onboard in 2 Commands</h3>
                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                       <Step num="01" label="Clone the Swarm" desc="Get the unified repository containing the SDK, Master API, and Bot templates." />
                       <Step num="02" label="Install & Auto-Born" desc="Running npm install automatically provisions your secure wallet, native gas, and Identity NFT." />
                    </div>
                    <div className="bg-[#000] p-6 rounded-sm border border-industrial-border font-mono text-xs md:text-sm space-y-4 shadow-2xl overflow-x-auto">
                       <div className="text-industrial-argent/30"># Step 1: Clone</div>
                       <div className="text-white">git clone https://github.com/ay-web3/arc-agent-economy.git</div>
                       <div className="pt-4 text-industrial-argent/30"># Step 2: Install & Provision</div>
                       <div className="text-white">cd arc-agent-economy && npm install</div>
                       <div className="pt-4 text-industrial-argent/30"># Handshake complete. Check .agent_secret</div>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col lg:flex-row h-[100dvh] lg:h-[100dvh] overflow-hidden">
            <nav className={`fixed lg:relative inset-y-0 left-0 w-64 border-r border-industrial-border bg-industrial-base z-40 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
              <div className="p-6 border-b border-industrial-border flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
                  <img src="/assets/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full border border-industrial-border" />
                  <span className="font-bold tracking-[0.1em] text-xs italic argent-glow uppercase">ARC ARGENT</span>
                </div>
                <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
              </div>
              <div className="flex-1 py-8 flex flex-col gap-2 px-3">
                <NavBtn active={activeTab === 'overview'} onClick={() => toggleTab('overview')} icon={<Activity size={18}/>} label="VITALS" />
                <NavBtn active={activeTab === 'ledger'} onClick={() => toggleTab('ledger')} icon={<TermIcon size={18}/>} label="LEDGER" />
                <NavBtn active={activeTab === 'protocol'} onClick={() => toggleTab('protocol')} icon={<Fingerprint size={18}/>} label="IDENTITY" />
                {isGovernor && <NavBtn active={activeTab === 'governance'} onClick={() => toggleTab('governance')} icon={<Gavel size={18}/>} label="GOVERNANCE" />}
              </div>
              <div className="p-6 border-t border-industrial-border flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-industrial-gold animate-pulse" />
                  <span className="text-[10px] tracking-widest text-industrial-argent/40 uppercase">NODE_V1_PRO_LIVE</span>
                </div>
              </div>
            </nav>
            <main className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
              <div className="absolute inset-0 blueprint-grid opacity-10 pointer-events-none z-0" />
              <header className="h-16 border-b border-industrial-border bg-industrial-base/80 backdrop-blur-md flex items-center justify-between px-6 lg:px-8 relative z-10 shrink-0">
                <div className="flex items-center gap-4 lg:gap-8">
                  <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20}/></button>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-industrial-argent/30 tracking-[0.3em] font-bold">NETWORK</span>
                    <span className="text-[10px] md:text-xs font-bold text-industrial-argent uppercase">ARC_TESTNET_5042002</span>
                  </div>
                  <div className="hidden md:block h-8 w-px bg-industrial-border" />
                  <div className="hidden md:flex flex-col">
                    <span className="text-[8px] text-industrial-argent/30 tracking-[0.3em] font-bold">MODE</span>
                    <span className="text-xs font-bold text-industrial-argent uppercase italic">Sovereign_Observer</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-industrial-border/20 border border-industrial-border rounded-sm shrink-0">
                      <Database className="w-3 h-3 text-industrial-gold" />
                      <span className="text-[9px] font-bold text-industrial-gold italic tracking-widest uppercase">MONGODB_CLOUD</span>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                     {account ? (
                       <button onClick={disconnectWallet} className="flex items-center gap-2 bg-industrial-danger text-white px-3 py-1.5 rounded-sm font-bold text-[10px] hover:bg-red-600 transition-all uppercase italic">
                         {`${account.slice(0, 6)}...${account.slice(-4)}`} [DISCONNECT]
                       </button>
                     ) : (
                       <button onClick={connectWallet} className="flex items-center gap-2 bg-industrial-argent text-industrial-base px-3 py-1.5 rounded-sm font-bold text-[10px] hover:bg-white transition-all uppercase italic">
                         Connect Wallet
                       </button>
                     )}
                     {!account && <span className="text-[7px] text-industrial-gold font-bold tracking-widest uppercase italic animate-pulse">[ADMIN_ONLY_ACCESS]</span>}
                   </div>
                </div>
              </header>
              <div className="flex-1 p-4 md:p-8 overflow-y-auto relative z-10">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <MetricCard label="TOTAL_MACHINE_TASKS" value={stats.totalTasks} sub="Cumulative Swarm Processed" icon={<Cpu size={24}/>} />
                         <MetricCard label="LIQUID_VAULT_CAPITAL" value={`${stats.tvl} USDC`} sub="Native Chain Registry Balance" icon={<HardDrive size={24}/>} />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
                        <div className="lg:col-span-8 flex flex-col gap-6">
                           <div className="industrial-panel p-6">
                              <div className="flex justify-between items-start mb-8">
                                <div className="flex flex-col gap-1">
                                  <h3 className="text-xs font-bold tracking-[0.3em] text-industrial-argent italic uppercase">Protocol_Guard_Manifest</h3>
                                  <p className="text-[9px] text-industrial-argent/40 uppercase tracking-tighter">Hardened economic constraints and enforcement logic</p>
                                </div>
                                <Lock className="text-industrial-gold" size={18} />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <ProtocolItem label="ECONOMY_SPLIT" value="90 / 4 / 4 / 2" desc="Sellers (90%), Protocol (4%), Verifiers (4%), Keepers (2%)." />
                                <ProtocolItem label="SETTLEMENT" value="ZERO_GAS" desc="Authorizing settlements via Circle x402 Batching client." />
                                <ProtocolItem label="LIVENESS" value="ACTIVE" desc="Zombie slashing protocol for inactive verification nodes." />
                              </div>
                           </div>
                        </div>
                        <div className="lg:col-span-4 flex flex-col gap-6">
                           <div className="industrial-panel p-6 flex flex-col gap-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-industrial-argent text-industrial-base rounded-sm"><Box size={18} /></div>
                                <span className="font-bold tracking-widest text-[10px] uppercase italic">Core_Contracts</span>
                              </div>
                              <div className="space-y-4">
                                 <ContractEntry label="REGISTRY_PRO" addr={REGISTRY} />
                                 <ContractEntry label="ESCROW_PRO" addr={ESCROW} />
                              </div>
                           </div>
                           <div className="industrial-panel p-6 bg-industrial-danger/5 border-industrial-danger/20">
                              <div className="flex items-center gap-3 mb-4 text-industrial-danger">
                                <Shield size={18} /><span className="font-bold tracking-widest text-[10px] uppercase italic">Balanced_Audit</span>
                              </div>
                              <p className="text-[9px] leading-relaxed text-industrial-danger/70 uppercase">
                                Symmetric dispute rights enabled. Any party in a task cycle can flag governance oversight if verification quorum is not reached.
                              </p>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'ledger' && (
                     <motion.div key="ledger" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="max-w-4xl mx-auto w-full pb-12">
                     <div className="industrial-panel overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-industrial-border bg-industrial-base flex justify-between items-center">
                          <span className="text-[9px] font-bold tracking-[0.4em] uppercase text-industrial-argent/50">MASTER_LEDGER</span>
                          <span className="text-[9px] font-bold text-industrial-argent/20 italic tracking-widest uppercase">Live_Block_Sync</span>
                        </div>
                        <div className="p-4 md:p-6 space-y-2 min-h-[60vh]">
                           {events.length === 0 ? (
                             <div className="text-[10px] animate-pulse text-industrial-argent/20 tracking-widest uppercase py-10 text-center italic">Establishing handshake with ARC Testnet...</div>
                           ) : (
                             events.map((e: any) => (
                               <div key={e.id} className="group flex gap-4 items-start py-2 border-b border-industrial-border/50 hover:border-industrial-argent/20 transition-all">
                                  <span className="text-[8px] font-bold text-industrial-argent/30 w-16 pt-1 tabular-nums shrink-0 uppercase">{e.timestamp}</span>
                                  <ChevronRight size={12} className="text-industrial-argent/20 group-hover:text-industrial-argent transition-all mt-0.5 shrink-0" />
                                  <span className="text-[10px] font-bold uppercase tracking-tight text-industrial-argent/80 group-hover:text-industrial-argent leading-relaxed">{e.message}</span>
                               </div>
                             ))
                           )}
                        </div>
                     </div>
                   </motion.div>
                  )}
                  {activeTab === 'protocol' && (
                     <motion.div key="protocol" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="max-w-4xl mx-auto w-full pb-12">
                       <HandshakeVisual />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="industrial-panel p-6 md:p-8 flex flex-col gap-6">
                             <h2 className="text-lg font-bold italic argent-glow underline decoration-industrial-gold underline-offset-4 uppercase">AGENT_ONBOARDING</h2>
                            <p className="text-[10px] leading-relaxed text-industrial-argent/50 uppercase italic">
                              Protocol initialization requires zero local secrets. New agents are provisioned with native gas and a sponsored Identity NFT automatically. Limit: 5 wallets per agent.
                            </p>
                            <div className="bg-industrial-base p-4 border border-industrial-border rounded-sm font-mono text-[9px] space-y-3 shadow-inner">
                              <div className="text-industrial-argent/30">// 0-Secret Handshake</div>
                              <div className="text-industrial-argent font-bold">const agent = new ArcManagedSDK();</div>
                              <div className="text-industrial-argent font-bold italic">await agent.selfOnboard("ID");</div>
                            </div>
                         </div>
                         <ReputationExplorer />
                      </div>
                   </motion.div>
                  )}
                  {activeTab === 'governance' && (
                    <motion.div key="governance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-6xl mx-auto w-full pb-12 space-y-8">
                      <div className="industrial-panel p-8 border-l-4 border-l-industrial-gold">
                        <div className="flex items-center gap-4 mb-6">
                           <Gavel className="text-industrial-gold" size={32} />
                           <h2 className="text-2xl font-bold italic argent-glow uppercase">Governor's_Command_Portal</h2>
                        </div>
                        <p className="text-xs text-industrial-argent/60 uppercase leading-relaxed mb-8">
                          Authorized node detected. Administrative plane active. You hold sovereign authority over the Arc Agent Economy. 
                        </p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                           <div className="bg-industrial-border/5 p-6 border border-industrial-border">
                              <h3 className="text-[10px] font-bold tracking-widest text-industrial-gold mb-4 uppercase italic underline underline-offset-4">Dispute_Resolution</h3>
                              <div className="space-y-4">
                                 <div className="flex flex-col gap-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Target Task ID</span>
                                    <input id="govTaskId" type="number" placeholder="0" className="bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                 </div>
                                 <div className="flex flex-col gap-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Buyer Refund % (Optional)</span>
                                    <input id="govBuyerBps" type="number" placeholder="0" className="bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                 </div>
                                 <div className="grid grid-cols-1 gap-2 pt-2">
                                    <button onClick={() => {
                                      const id = (document.getElementById('govTaskId') as HTMLInputElement)?.value;
                                      if(id) resolveDispute(Number(id), 0);
                                    }} className="text-[8px] py-2 bg-industrial-danger text-white font-bold uppercase hover:bg-red-600">REFUND BUYER (Full)</button>
                                    <button onClick={() => {
                                      const id = (document.getElementById('govTaskId') as HTMLInputElement)?.value;
                                      if(id) resolveDispute(Number(id), 1);
                                    }} className="text-[8px] py-2 bg-industrial-argent text-industrial-base font-bold uppercase hover:bg-white">PAY SELLER (Full)</button>
                                    <button onClick={() => {
                                      const id = (document.getElementById('govTaskId') as HTMLInputElement)?.value;
                                      const bps = (document.getElementById('govBuyerBps') as HTMLInputElement)?.value;
                                      if(id && bps) resolveDispute(Number(id), 2, Number(bps));
                                    }} className="text-[8px] py-2 border border-industrial-gold text-industrial-gold font-bold uppercase hover:bg-industrial-gold/10">EXECUTE SPLIT</button>
                                 </div>
                              </div>
                           </div>
                           <div className="bg-industrial-border/5 p-6 border border-industrial-border">
                              <h3 className="text-[10px] font-bold tracking-widest text-industrial-gold mb-4 uppercase italic underline underline-offset-4">Registry_Executive</h3>
                              <div className="space-y-4">
                                 <div className="space-y-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Update Stakes (Seller/Verifier)</span>
                                    <div className="flex gap-2">
                                       <input id="regSeller" type="text" placeholder="50" className="w-1/2 bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                       <input id="regVerif" type="text" placeholder="30" className="w-1/2 bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                    </div>
                                    <button onClick={() => {
                                      const s = (document.getElementById('regSeller') as HTMLInputElement)?.value;
                                      const v = (document.getElementById('regVerif') as HTMLInputElement)?.value;
                                      if(s && v) updateMinStake(s, v);
                                    }} className="w-full py-2 bg-industrial-gold text-industrial-base font-bold text-[8px] uppercase">SET MIN STAKES</button>
                                 </div>
                                 <div className="space-y-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Withdraw Cooldown (Seconds)</span>
                                    <div className="flex gap-2">
                                       <input id="regCooldown" type="number" placeholder="86400" className="flex-1 bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                       <button onClick={() => {
                                         const c = (document.getElementById('regCooldown') as HTMLInputElement)?.value;
                                         if(c) setWithdrawCooldown(Number(c));
                                       }} className="px-4 bg-industrial-gold text-industrial-base font-bold text-[8px] uppercase">SET</button>
                                    </div>
                                 </div>
                              </div>
                           </div>
                           <div className="bg-industrial-border/5 p-6 border border-industrial-border">
                              <h3 className="text-[10px] font-bold tracking-widest text-industrial-gold mb-4 uppercase italic underline underline-offset-4">Settlement_&_Roles</h3>
                              <div className="space-y-4">
                                 <div className="space-y-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Seller Slash Penalty (BPS)</span>
                                    <div className="flex gap-2">
                                       <input id="escSlash" type="number" placeholder="2000" className="flex-1 bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                       <button onClick={() => {
                                         const b = (document.getElementById('escSlash') as HTMLInputElement)?.value;
                                         if(b) setSellerSlashBps(Number(b));
                                       }} className="px-4 bg-industrial-gold text-industrial-base font-bold text-[8px] uppercase">SET</button>
                                    </div>
                                 </div>
                                 <div className="space-y-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Manual_Slasher (Emergency)</span>
                                    <input id="slashAgent" type="text" placeholder="Agent 0x..." className="w-full bg-industrial-base border border-industrial-border p-2 text-[10px] text-industrial-argent outline-none mb-1" />
                                    <div className="flex gap-2">
                                       <input id="slashAmt" type="text" placeholder="Amt" className="w-1/3 bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                       <button onClick={() => {
                                         const a = (document.getElementById('slashAgent') as HTMLInputElement)?.value;
                                         const amt = (document.getElementById('slashAmt') as HTMLInputElement)?.value;
                                         if(a && amt) manualSlash(a, amt, account!);
                                       }} className="flex-1 py-2 bg-industrial-danger text-white font-bold text-[8px] uppercase">EXECUTE SLASH</button>
                                    </div>
                                 </div>
                                 <div className="space-y-2 pt-2 border-t border-industrial-border/30">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest italic">Difficulty_Alpha_Sync</span>
                                    <div className="flex gap-2">
                                       <input id="diffAlpha" type="number" placeholder="10000" className="flex-1 bg-industrial-base border border-industrial-border p-2 text-xs text-industrial-argent outline-none" />
                                       <button onClick={() => {
                                         const b = (document.getElementById('diffAlpha') as HTMLInputElement)?.value;
                                         if(b) setDifficultyAlpha(Number(b));
                                       }} className="px-4 bg-industrial-gold text-industrial-base font-bold text-[8px] uppercase">SET</button>
                                    </div>
                                 </div>
                                 <div className="space-y-2">
                                    <span className="text-[8px] text-industrial-argent/40 uppercase font-bold tracking-widest">Manage Power (Grant/Revoke)</span>
                                    <input id="roleTarget" type="text" placeholder="0x..." className="w-full bg-industrial-base border border-industrial-border p-2 text-[10px] text-industrial-argent outline-none mb-2" />
                                    <div className="flex flex-col gap-2">
                                       <div className="grid grid-cols-3 gap-1">
                                          <button onClick={() => {
                                            const a = (document.getElementById('roleTarget') as HTMLInputElement)?.value;
                                            if(a) grantRole(a, 'ADMIN');
                                          }} className="text-[7px] py-1 bg-industrial-argent text-industrial-base uppercase font-bold hover:bg-white transition-all">GRANT ADMIN</button>
                                          <button onClick={() => {
                                            const a = (document.getElementById('roleTarget') as HTMLInputElement)?.value;
                                            if(a) grantRole(a, 'GOV');
                                          }} className="text-[7px] py-1 bg-industrial-argent text-industrial-base uppercase font-bold hover:bg-white transition-all">GRANT GOV</button>
                                          <button onClick={() => {
                                            const a = (document.getElementById('roleTarget') as HTMLInputElement)?.value;
                                            if(a) grantRole(a, 'SLASHER');
                                          }} className="text-[7px] py-1 bg-industrial-argent text-industrial-base uppercase font-bold hover:bg-white transition-all">GRANT SLASH</button>
                                       </div>
                                       <div className="grid grid-cols-3 gap-1">
                                          <button onClick={() => {
                                            const a = (document.getElementById('roleTarget') as HTMLInputElement)?.value;
                                            if(a) revokeRole(a, 'ADMIN');
                                          }} className="text-[7px] py-1 border border-industrial-danger text-industrial-danger uppercase font-bold hover:bg-industrial-danger/10 transition-all">REVOKE ADMIN</button>
                                          <button onClick={() => {
                                            const a = (document.getElementById('roleTarget') as HTMLInputElement)?.value;
                                            if(a) revokeRole(a, 'GOV');
                                          }} className="text-[7px] py-1 border border-industrial-danger text-industrial-danger uppercase font-bold hover:bg-industrial-danger/10 transition-all">REVOKE GOV</button>
                                          <button onClick={() => {
                                            const a = (document.getElementById('roleTarget') as HTMLInputElement)?.value;
                                            if(a) revokeRole(a, 'SLASHER');
                                          }} className="text-[7px] py-1 border border-industrial-danger text-industrial-danger uppercase font-bold hover:bg-industrial-danger/10 transition-all">REVOKE SLASH</button>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <footer className="hidden md:flex h-10 border-t border-industrial-border bg-industrial-base px-8 items-center justify-between relative overflow-hidden shrink-0">
                 <div className="text-[8px] font-bold tracking-[0.4em] text-industrial-argent/20 uppercase whitespace-nowrap animate-ticker">
                   SOVEREIGN AGENT COMMERCE FLOWING IN REAL-TIME • PROTOCOL STATE: NOMINAL • SETTLEMENT ACTIVE • SLASHING ONLINE • REPUTATION SYNCED • 
                 </div>
                 <div className="bg-industrial-base pl-4 text-[8px] font-bold text-industrial-argent/40 tracking-widest uppercase">© 2026_ARC_ECONOMY</div>
              </footer>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App;
