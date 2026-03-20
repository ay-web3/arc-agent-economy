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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REGISTRY = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const ESCROW = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";

function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'protocol'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { stats, events } = useArcEconomy();

  const toggleTab = (tab: 'overview' | 'ledger' | 'protocol') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-industrial-base text-industrial-argent flex flex-col lg:flex-row overflow-x-hidden">
      {/* Background Grid */}
      <div className="fixed inset-0 blueprint-grid opacity-10 pointer-events-none z-0" />

      {/* Mobile Top Header */}
      <div className="lg:hidden h-16 border-b border-industrial-border bg-industrial-base flex items-center justify-between px-6 relative z-30">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6" />
          <span className="font-bold tracking-widest text-xs italic uppercase">ARC ARGENT</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <nav className={`
        fixed lg:relative inset-y-0 left-0 w-64 border-r border-industrial-border bg-industrial-base z-40 transform transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="hidden lg:flex p-6 border-b border-industrial-border items-center gap-3">
          <Shield className="w-8 h-8 text-industrial-argent" />
          <span className="font-bold tracking-[0.1em] text-xs italic argent-glow uppercase">ARC ARGENT</span>
        </div>
        
        <div className="flex-1 py-8 flex flex-col gap-2 px-3">
          <NavBtn active={activeTab === 'overview'} onClick={() => toggleTab('overview')} icon={<Activity size={18}/>} label="VITALS" />
          <NavBtn active={activeTab === 'ledger'} onClick={() => toggleTab('ledger')} icon={<TermIcon size={18}/>} label="LEDGER" />
          <NavBtn active={activeTab === 'protocol'} onClick={() => toggleTab('protocol')} icon={<Fingerprint size={18}/>} label="IDENTITY" />
        </div>

        <div className="p-6 border-t border-industrial-border flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-industrial-gold animate-pulse" />
            <span className="text-[10px] tracking-widest text-industrial-argent/40">NODE_V1.0.0_PRO</span>
          </div>
        </div>
      </nav>

      {/* Main Console */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top Status Bar (Desktop) */}
        <header className="hidden lg:flex h-16 border-b border-industrial-border bg-industrial-base/80 backdrop-blur-md items-center justify-between px-8">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[8px] text-industrial-argent/30 tracking-[0.3em] font-bold">NETWORK</span>
              <span className="text-xs font-bold text-industrial-argent">ARC_TESTNET_5042002</span>
            </div>
            <div className="h-8 w-px bg-industrial-border" />
            <div className="flex flex-col">
              <span className="text-[8px] text-industrial-argent/30 tracking-[0.3em] font-bold">MODE</span>
              <span className="text-xs font-bold text-industrial-argent uppercase">Observer_Sovereign</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-industrial-border/20 border border-industrial-border rounded-sm">
                <Database className="w-3 h-3 text-industrial-gold" />
                <span className="text-[9px] font-bold text-industrial-gold italic tracking-widest uppercase">MONGODB_SYNC</span>
             </div>
          </div>
        </header>

        {/* Console Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)] lg:max-h-screen">
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
                   <MetricCard label="TOTAL_AGENT_TASKS" value={stats.totalTasks} sub="Cumulative Processed" icon={<Cpu size={24}/>} />
                   <MetricCard label="ESCROW_LIQUIDITY" value={`${stats.tvl} USDC`} sub="Native Vault Balance" icon={<HardDrive size={24}/>} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Col: Protocol Guard */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                     <div className="industrial-panel p-6">
                        <div className="flex justify-between items-start mb-8">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-xs font-bold tracking-[0.3em] text-industrial-argent">PROTOCOL_GUARD_MANIFEST</h3>
                            <p className="text-[9px] text-industrial-argent/40 uppercase">Economic constraints and enforcement logic</p>
                          </div>
                          <Lock className="text-industrial-gold" size={18} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <ProtocolItem label="Cooling_Off" value="60 MINS" desc="Window for disputes before settlement." />
                          <ProtocolItem label="Penalty" value="20.00 %" desc="Stake slash for malicious performance." />
                          <ProtocolItem label="Liveness" value="ACTIVE" desc="Zombie slashing for inactive nodes." />
                        </div>
                     </div>
                  </div>

                  {/* Right Col: Contracts & Audit */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                     <div className="industrial-panel p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-industrial-argent text-industrial-base rounded-sm">
                             <Box size={18} />
                          </div>
                          <span className="font-bold tracking-widest text-xs uppercase italic">Contracts</span>
                        </div>
                        <div className="space-y-4">
                           <ContractEntry label="Registry" addr={REGISTRY} />
                           <ContractEntry label="Escrow" addr={ESCROW} />
                        </div>
                     </div>

                     <div className="industrial-panel p-6 bg-industrial-danger/5 border-industrial-danger/20">
                        <div className="flex items-center gap-3 mb-4 text-industrial-danger">
                          <Shield size={18} />
                          <span className="font-bold tracking-widest text-xs uppercase italic">Audit</span>
                        </div>
                        <p className="text-[9px] leading-relaxed text-industrial-danger/70 uppercase">
                          Symmetric dispute rights active. Liveness window strictly enforced on all task cycles.
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
               className="max-w-4xl mx-auto w-full"
             >
               <div className="industrial-panel overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-industrial-border bg-industrial-base flex justify-between items-center">
                    <span className="text-[9px] font-bold tracking-[0.4em] uppercase text-industrial-argent/50">MASTER_LEDGER</span>
                    <span className="text-[9px] font-bold text-industrial-argent/20 italic tracking-widest">LIVE_BLOCK_DECODE</span>
                  </div>
                  <div className="p-4 md:p-6 space-y-2 min-h-[50vh]">
                     {events.length === 0 ? (
                       <div className="text-[10px] animate-pulse text-industrial-argent/20 tracking-widest uppercase py-4 text-center">Syncing with ARC Testnet...</div>
                     ) : (
                       events.map((e) => (
                         <div key={e.id} className="group flex gap-4 items-start py-2 border-b border-industrial-border/50 hover:border-industrial-argent/20 transition-all">
                            <span className="text-[8px] font-bold text-industrial-argent/30 w-16 pt-1 tabular-nums shrink-0">{e.timestamp}</span>
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
               className="max-w-4xl mx-auto w-full"
             >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="industrial-panel p-6 md:p-8 flex flex-col gap-6">
                      <h2 className="text-lg font-bold italic argent-glow underline decoration-industrial-gold underline-offset-4 uppercase">ONBOARDING</h2>
                      <p className="text-[10px] leading-relaxed text-industrial-argent/50 uppercase">
                        Requires zero local secrets. New agents are provisioned with secure vault-managed identity and unique hashed secrets.
                      </p>
                      <div className="bg-industrial-base p-4 border border-industrial-border rounded-sm font-mono text-[9px] space-y-3">
                        <div className="text-industrial-argent/30">// 0-Secret Onboarding</div>
                        <div className="text-industrial-argent">const agent = new ArcManagedSDK();</div>
                        <div className="text-industrial-argent">await agent.selfOnboard("ID");</div>
                      </div>
                   </div>

                   <div className="industrial-panel p-6 md:p-8 flex flex-col gap-6 border-l-2 border-l-industrial-gold">
                      <h2 className="text-lg font-bold italic argent-glow uppercase">ERC-8004_STANDARD</h2>
                      <p className="text-[10px] leading-relaxed text-industrial-argent/50 uppercase">
                        Identities are mapped to global ARC Registry. Reputation is immutable and builds automatically across the swarm network.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                            <span className="text-[8px] text-industrial-argent/40 block mb-2 uppercase tracking-widest">Global Rank</span>
                            <span className="text-xl font-bold text-industrial-gold tracking-tighter tabular-nums italic uppercase">V-PRO</span>
                         </div>
                         <div className="p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                            <span className="text-[8px] text-industrial-argent/40 block mb-2 uppercase tracking-widest">Verified Tasks</span>
                            <span className="text-xl font-bold text-industrial-argent tracking-tighter tabular-nums italic uppercase">LIVE</span>
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Ticker (Desktop only) */}
        <footer className="hidden lg:flex h-10 border-t border-industrial-border bg-industrial-base px-8 items-center justify-between relative overflow-hidden">
           <div className="text-[8px] font-bold tracking-[0.4em] text-industrial-argent/20 uppercase whitespace-nowrap animate-ticker">
             SOVEREIGN AGENT COMMERCE FLOWING IN REAL-TIME • PROTOCOL STATE: NOMINAL • SETTLEMENT ACTIVE • SLASHING ONLINE • 
           </div>
           <div className="bg-industrial-base pl-4 text-[8px] font-bold text-industrial-argent/40 tracking-widest">
             © 2026_ARC_ECONOMY
           </div>
        </footer>
      </main>
    </div>
  )
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`group flex items-center gap-4 px-4 py-3 transition-all rounded-sm relative ${
        active ? 'bg-industrial-argent text-industrial-base shadow-lg' : 'text-industrial-argent/40 hover:bg-industrial-border/20'
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
    <div className="industrial-panel p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        {icon}
      </div>
      <div className="flex flex-col gap-1 relative z-10">
        <span className="text-[8px] font-bold tracking-[0.3em] text-industrial-argent/40 uppercase">{label}</span>
        <span className="text-2xl font-bold tracking-tighter text-industrial-argent italic argent-glow tabular-nums uppercase break-all">{value}</span>
        {sub && <span className="text-[8px] text-industrial-argent/20 tracking-widest uppercase mt-1">{sub}</span>}
      </div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1 bg-industrial-gold/10 group-hover:w-full transition-all duration-700" />
    </div>
  )
}

function ProtocolItem({ label, value, desc }: { label: string, value: string, desc: string }) {
  return (
    <div className="flex flex-col gap-2">
       <span className="text-[9px] font-bold text-industrial-argent tracking-widest underline decoration-industrial-gold decoration-2 underline-offset-4 uppercase">{label}</span>
       <span className="text-sm font-bold text-industrial-argent italic uppercase">{value}</span>
       <p className="text-[8px] text-industrial-argent/30 leading-relaxed uppercase">{desc}</p>
    </div>
  )
}

function ContractEntry({ label, addr }: { label: string, addr: string }) {
  return (
    <div className="flex flex-col gap-1 overflow-hidden">
       <span className="text-[8px] font-bold text-industrial-argent/30 uppercase tracking-[0.2em]">{label}</span>
       <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] text-industrial-argent font-mono uppercase bg-industrial-border/30 px-2 py-0.5 rounded-sm truncate">
            {addr.slice(0, 10)}...{addr.slice(-8)}
          </span>
          <a href={`https://explorer.testnet.arc.network/address/${addr}`} target="_blank" className="text-industrial-argent/20 hover:text-industrial-gold transition-colors shrink-0">
            <ChevronRight size={12} />
          </a>
       </div>
    </div>
  )
}

export default App
