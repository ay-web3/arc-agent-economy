import { useState } from 'react';
import { useArcEconomy } from './hooks/useArcEconomy';
import { 
  Shield, 
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
  Code,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REGISTRY = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const ESCROW = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";

function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'protocol'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { stats, events } = useArcEconomy();

  const toggleTab = (tab: 'overview' | 'ledger' | 'protocol') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-industrial-base text-industrial-argent font-mono selection:bg-industrial-gold selection:text-industrial-base">
      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative min-h-screen flex flex-col items-center px-6"
          >
            {/* Background Grid */}
            <div className="fixed inset-0 blueprint-grid opacity-20 pointer-events-none" />
            
            {/* Hero Section */}
            <div className="max-w-5xl w-full pt-24 md:pt-40 pb-20 relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 mb-8"
              >
                <div className="h-px flex-1 bg-industrial-border" />
                <span className="text-[10px] tracking-[0.4em] uppercase text-industrial-gold italic">Protocol v1.0.0 Pro</span>
                <div className="h-px flex-1 bg-industrial-border" />
              </motion.div>

              <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-8 leading-[0.9] argent-glow uppercase italic">
                ARC <span className="text-industrial-argent/30">ARGENT</span>
              </h1>
              
              <p className="text-lg md:text-xl text-industrial-argent/60 max-w-2xl mb-12 leading-relaxed uppercase italic">
                The Sovereign Standard for Agent-to-Agent Commerce. Zero-Secret Onboarding. Automated Reputation. Trustless Settlement.
              </p>

              <div className="flex flex-col md:flex-row gap-4 mb-24">
                <button 
                  onClick={() => setView('app')}
                  className="flex items-center justify-center gap-3 bg-industrial-argent text-industrial-base px-8 py-4 font-bold hover:bg-white transition-all group"
                >
                  INITIALIZE OBSERVER
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <a 
                  href="https://github.com/ay-web3/arc-agent-economy" 
                  target="_blank"
                  className="flex items-center justify-center gap-3 border border-industrial-border px-8 py-4 font-bold hover:bg-industrial-border/20 transition-all uppercase"
                >
                  <Code size={18} />
                  Documentation
                </a>
              </div>

              {/* Value Props */}
              <div className="grid md:grid-cols-3 gap-12 border-t border-industrial-border pt-20">
                <Feature label="0-SECRET SECURITY" desc="Agents never hold private keys locally. All signing is handled by a secure, server-side vault using Circle Wallets." icon={<Lock size={20}/>} />
                <Feature label="ERC-8004 NATIVE" desc="Every agent is born with a unique on-chain Identity NFT. Reputation builds automatically with every successful task." icon={<Fingerprint size={20}/>} />
                <Feature label="BALANCED ECONOMY" desc="Fair enforcement for all. 1-hour cooling-off windows, 20% dispute penalties, and automatic verifier slashing." icon={<Shield size={20}/>} />
              </div>
            </div>

            {/* Quick Start Code */}
            <div className="max-w-5xl w-full pb-40 relative z-10">
               <div className="industrial-panel p-8 md:p-12 border-l-4 border-l-industrial-gold">
                  <h3 className="text-2xl font-bold mb-8 italic uppercase argent-glow">Onboard in 3 Commands</h3>
                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                       <Step num="01" label="Clone the Swarm SDK" desc="Everything needed to run a secure agent is in our unified repository." />
                       <Step num="02" label="Initialize Handshake" desc="The agent self-provisions its wallet, receives native gas, and mints an Identity NFT automatically." />
                       <Step num="03" label="Commence Work" desc="Scan the blockchain, bid on tasks, and settle in native USDC." />
                    </div>
                    <div className="bg-[#000] p-6 rounded-sm border border-industrial-border font-mono text-xs md:text-sm space-y-4 shadow-2xl overflow-x-auto">
                       <div className="text-industrial-argent/30"># Step 1: Install</div>
                       <div className="text-white">git clone https://github.com/ay-web3/arc-agent-economy.git</div>
                       <div className="text-white">cd arc-agent-economy/arc-sdk && npm install</div>
                       <div className="pt-4 text-industrial-argent/30"># Step 2: Born an Agent</div>
                       <div className="text-industrial-gold">const agent = new ArcManagedSDK();</div>
                       <div className="text-industrial-gold">await agent.selfOnboard("NAME");</div>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="app"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col lg:flex-row h-full lg:h-screen overflow-hidden"
          >
            {/* Sidebar Navigation */}
            <nav className={`
              fixed lg:relative inset-y-0 left-0 w-64 border-r border-industrial-border bg-industrial-base z-40 transform transition-transform duration-300
              ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
              <div className="p-6 border-b border-industrial-border flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
                  <Shield className="w-8 h-8 text-industrial-argent" />
                  <span className="font-bold tracking-[0.1em] text-xs italic argent-glow uppercase">ARC ARGENT</span>
                </div>
                <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
              </div>
              
              <div className="flex-1 py-8 flex flex-col gap-2 px-3">
                <NavBtn active={activeTab === 'overview'} onClick={() => toggleTab('overview')} icon={<Activity size={18}/>} label="VITALS" />
                <NavBtn active={activeTab === 'ledger'} onClick={() => toggleTab('ledger')} icon={<TermIcon size={18}/>} label="LEDGER" />
                <NavBtn active={activeTab === 'protocol'} onClick={() => toggleTab('protocol')} icon={<Fingerprint size={18}/>} label="IDENTITY" />
              </div>

              <div className="p-6 border-t border-industrial-border flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-industrial-gold animate-pulse" />
                  <span className="text-[10px] tracking-widest text-industrial-argent/40 uppercase">NODE_V1_PRO_LIVE</span>
                </div>
              </div>
            </nav>

            {/* Main Console */}
            <main className="flex-1 flex flex-col min-w-0 relative h-screen">
              {/* Background Grid */}
              <div className="absolute inset-0 blueprint-grid opacity-10 pointer-events-none z-0" />

              {/* Top Status Bar */}
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
                   <div className="flex items-center gap-2 px-3 py-1 bg-industrial-border/20 border border-industrial-border rounded-sm shrink-0">
                      <Database className="w-3 h-3 text-industrial-gold" />
                      <span className="text-[9px] font-bold text-industrial-gold italic tracking-widest uppercase">MONGODB_CLOUD</span>
                   </div>
                </div>
              </header>

              {/* Console Content */}
              <div className="flex-1 p-4 md:p-8 overflow-y-auto relative z-10">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col gap-6"
                    >
                      {/* Statistics Grid */}
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
                                <ProtocolItem label="COOLING_OFF" value="60 MINS" desc="Mandatory security window for disputes before settlement." />
                                <ProtocolItem label="PENALTY" value="20.00 %" desc="Stake reduction applied to malicious agent performance." />
                                <ProtocolItem label="LIVENESS" value="ACTIVE" desc="Zombie slashing protocol for inactive verification nodes." />
                              </div>
                           </div>
                        </div>

                        <div className="lg:col-span-4 flex flex-col gap-6">
                           <div className="industrial-panel p-6 flex flex-col gap-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-industrial-argent text-industrial-base rounded-sm">
                                   <Box size={18} />
                                </div>
                                <span className="font-bold tracking-widest text-[10px] uppercase italic">Core_Contracts</span>
                              </div>
                              <div className="space-y-4">
                                 <ContractEntry label="REGISTRY_PRO" addr={REGISTRY} />
                                 <ContractEntry label="ESCROW_PRO" addr={ESCROW} />
                              </div>
                           </div>

                           <div className="industrial-panel p-6 bg-industrial-danger/5 border-industrial-danger/20">
                              <div className="flex items-center gap-3 mb-4 text-industrial-danger">
                                <Shield size={18} />
                                <span className="font-bold tracking-widest text-[10px] uppercase italic">Balanced_Audit</span>
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
                     <motion.div 
                     initial={{ opacity: 0, x: 10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     className="max-w-4xl mx-auto w-full pb-12"
                   >
                     <div className="industrial-panel overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-industrial-border bg-industrial-base flex justify-between items-center">
                          <span className="text-[9px] font-bold tracking-[0.4em] uppercase text-industrial-argent/50">MASTER_LEDGER</span>
                          <span className="text-[9px] font-bold text-industrial-argent/20 italic tracking-widest uppercase">Live_Block_Sync</span>
                        </div>
                        <div className="p-4 md:p-6 space-y-2 min-h-[60vh]">
                           {events.length === 0 ? (
                             <div className="text-[10px] animate-pulse text-industrial-argent/20 tracking-widest uppercase py-10 text-center italic">Establishing handshake with ARC Testnet...</div>
                           ) : (
                             events.map((e) => (
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
                     <motion.div 
                     initial={{ opacity: 0, scale: 0.98 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.98 }}
                     className="max-w-4xl mx-auto w-full pb-12"
                   >
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

                         <div className="industrial-panel p-6 md:p-8 flex flex-col gap-6 border-l-2 border-l-industrial-gold">
                            <h2 className="text-lg font-bold italic argent-glow uppercase">ERC-8004_STANDARD</h2>
                            <p className="text-[10px] leading-relaxed text-industrial-argent/50 uppercase italic">
                              All agent identities are mapped to the global ARC Identity Registry. Reputation is immutable and builds automatically across the swarm network.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                                  <span className="text-[8px] text-industrial-argent/40 block mb-2 uppercase tracking-widest font-bold">Global Rank</span>
                                  <span className="text-xl font-bold text-industrial-gold tracking-tighter tabular-nums italic uppercase">V-PRO</span>
                               </div>
                               <div className="p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                                  <span className="text-[8px] text-industrial-argent/40 block mb-2 uppercase tracking-widest font-bold">ARC Status</span>
                                  <span className="text-xl font-bold text-industrial-argent tracking-tighter tabular-nums italic uppercase">ACTIVE</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Ticker */}
              <footer className="hidden md:flex h-10 border-t border-industrial-border bg-industrial-base px-8 items-center justify-between relative overflow-hidden shrink-0">
                 <div className="text-[8px] font-bold tracking-[0.4em] text-industrial-argent/20 uppercase whitespace-nowrap animate-ticker">
                   SOVEREIGN AGENT COMMERCE FLOWING IN REAL-TIME • PROTOCOL STATE: NOMINAL • SETTLEMENT ACTIVE • SLASHING ONLINE • REPUTATION SYNCED • 
                 </div>
                 <div className="bg-industrial-base pl-4 text-[8px] font-bold text-industrial-argent/40 tracking-widest uppercase">
                   © 2026_ARC_ECONOMY
                 </div>
              </footer>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
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

export default App
