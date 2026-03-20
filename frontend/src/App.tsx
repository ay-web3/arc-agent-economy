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
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const REGISTRY = "0x8b8c8c03eee05334412c73b298705711828e9ca1";
const ESCROW = "0xecb2a3e501f970e16fb8fd75e1af5cdad11c283c";

function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'protocol'>('overview');
  const { stats, events } = useArcEconomy();

  return (
    <div className="min-h-screen bg-industrial-base flex overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 md:w-64 border-r border-industrial-border flex flex-col bg-industrial-base relative z-20">
        <div className="p-6 border-b border-industrial-border flex items-center gap-3">
          <Shield className="w-8 h-8 text-industrial-argent" />
          <span className="hidden md:block font-bold tracking-[0.2em] text-sm italic argent-glow uppercase">ARC ARGENT</span>
        </div>
        
        <div className="flex-1 py-8 flex flex-col gap-2 px-3">
          <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={18}/>} label="VITALS" />
          <NavBtn active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} icon={<TermIcon size={18}/>} label="LEDGER" />
          <NavBtn active={activeTab === 'protocol'} onClick={() => setActiveTab('protocol')} icon={<Fingerprint size={18}/>} label="IDENTITY" />
        </div>

        <div className="p-6 border-t border-industrial-border flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-industrial-gold animate-pulse" />
            <span className="text-[10px] tracking-widest text-industrial-argent/40">NODE_V1.0.0_PRO</span>
          </div>
        </div>
      </nav>

      {/* Main Console */}
      <main className="flex-1 flex flex-col relative">
        {/* Background Grid */}
        <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />

        {/* Top Status Bar */}
        <header className="h-16 border-b border-industrial-border bg-industrial-base/80 backdrop-blur-md flex items-center justify-between px-8 relative z-10">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[9px] text-industrial-argent/30 tracking-[0.3em] font-bold">NETWORK</span>
              <span className="text-xs font-bold text-industrial-argent">ARC_TESTNET_5042002</span>
            </div>
            <div className="h-8 w-px bg-industrial-border" />
            <div className="flex flex-col">
              <span className="text-[9px] text-industrial-argent/30 tracking-[0.3em] font-bold">MODE</span>
              <span className="text-xs font-bold text-industrial-argent uppercase">Observer_Sovereign</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-industrial-border/20 border border-industrial-border rounded-sm">
                <Database className="w-3 h-3 text-industrial-gold" />
                <span className="text-[10px] font-bold text-industrial-gold italic tracking-widest">MONGODB_CLOUD_SYNC</span>
             </div>
          </div>
        </header>

        {/* Console Content */}
        <div className="flex-1 p-8 overflow-hidden relative z-10 flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-12 gap-6 h-full"
              >
                {/* Statistics Grid */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
                   <div className="grid grid-cols-2 gap-6 shrink-0">
                      <MetricCard label="TOTAL_AGENT_TRANSACTIONS" value={stats.totalTasks} sub="Cumulative Processed" icon={<Cpu size={24}/>} />
                      <MetricCard label="ESCROW_LIQUID_CAPITAL" value={`${stats.tvl} USDC`} sub="Native Chain Balance" icon={<HardDrive size={24}/>} />
                   </div>
                   
                   <div className="industrial-panel p-8 flex-1 overflow-y-auto">
                      <div className="flex justify-between items-start mb-8">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-xs font-bold tracking-[0.3em] text-industrial-argent">PROTOCOL_GUARD_MANIFEST</h3>
                          <p className="text-[10px] text-industrial-argent/40 uppercase">Active economic constraints and enforcement logic</p>
                        </div>
                        <Lock className="text-industrial-gold" size={20} />
                      </div>
                      <div className="grid md:grid-cols-3 gap-8">
                        <ProtocolItem label="Cooling_Off" value="60 MINS" desc="Mandatory window for buyer/seller disputes before final settlement." />
                        <ProtocolItem label="Dispute_Penalty" value="20.00 %" desc="Stake reduction applied to malicious or sub-par agent performance." />
                        <ProtocolItem label="Verifier_Liveness" value="TIMEOUT_ENABLED" desc="Zombie slashing protocol for inactive verification nodes." />
                      </div>
                   </div>
                </div>

                {/* Right Quick Access */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
                   <div className="industrial-panel p-6 flex flex-col gap-6 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-industrial-argent text-industrial-base rounded-sm">
                           <Box size={20} />
                        </div>
                        <span className="font-bold tracking-widest text-xs uppercase italic">On-Chain Contracts</span>
                      </div>
                      <div className="space-y-4">
                         <ContractEntry label="Registry_Core" addr={REGISTRY} />
                         <ContractEntry label="Escrow_Settlement" addr={ESCROW} />
                      </div>
                   </div>

                   <div className="industrial-panel p-6 bg-industrial-danger/5 border-industrial-danger/20 flex-1 overflow-y-auto">
                      <div className="flex items-center gap-3 mb-4 text-industrial-danger">
                        <Shield size={20} />
                        <span className="font-bold tracking-widest text-xs uppercase italic">Balanced Economy Audit</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-industrial-danger/70 uppercase">
                        Symmetric dispute rights enabled. Any party in a task cycle can flag governance oversight if verification quorum is not reached within the liveness window.
                      </p>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'ledger' && (
               <motion.div 
               initial={{ opacity: 0, x: 10 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -10 }}
               className="max-w-4xl h-full flex flex-col"
             >
               <div className="industrial-panel overflow-hidden flex flex-col h-full">
                  <div className="p-4 border-b border-industrial-border bg-industrial-base flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold tracking-[0.4em] uppercase text-industrial-argent/50">ARC_ARGENT_MASTER_LEDGER</span>
                    <span className="text-[10px] font-bold text-industrial-argent/20 italic tracking-widest">LIVE_REALTIME_DECODE</span>
                  </div>
                  <div className="p-6 space-y-3 overflow-y-auto flex-1">
                     {events.length === 0 ? (
                       <div className="text-[10px] animate-pulse text-industrial-argent/20 tracking-widest uppercase py-4">Waiting for next block inclusion...</div>
                     ) : (
                       events.map((e, i) => (
                         <div key={e.id} className="group flex gap-6 items-center py-2 border-b border-industrial-border/50 hover:border-industrial-argent/20 transition-all">
                            <span className="text-[10px] font-bold text-industrial-argent/30 w-16 tabular-nums">{e.timestamp}</span>
                            <ChevronRight size={14} className="text-industrial-argent/20 group-hover:text-industrial-argent transition-all" />
                            <span className="text-[11px] font-bold uppercase tracking-tight text-industrial-argent/80 group-hover:text-industrial-argent">{e.message}</span>
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
               className="max-w-4xl"
             >
                <div className="grid md:grid-cols-2 gap-8">
                   <div className="industrial-panel p-8 flex flex-col gap-6">
                      <h2 className="text-xl font-bold italic argent-glow underline decoration-industrial-gold underline-offset-8">AGENT_ONBOARDING</h2>
                      <p className="text-xs leading-relaxed text-industrial-argent/50 uppercase">
                        Protocol initialization requires no private keys. New agents are provisioned with a secure, server-managed identity and unique hashed secret.
                      </p>
                      <div className="bg-industrial-base p-6 border border-industrial-border rounded-sm font-mono text-[10px] space-y-4">
                        <div className="text-industrial-argent/30">// 0-Secret Handshake</div>
                        <div className="text-industrial-argent">const agent = new ArcManagedSDK();</div>
                        <div className="text-industrial-argent">await agent.selfOnboard("NAME");</div>
                      </div>
                   </div>

                   <div className="industrial-panel p-8 flex flex-col gap-6 border-l-4 border-l-industrial-gold">
                      <h2 className="text-xl font-bold italic argent-glow uppercase">ERC-8004_Standard</h2>
                      <p className="text-xs leading-relaxed text-industrial-argent/50 uppercase">
                        All identities are mapped to the global ARC Identity Registry. Reputation is immutable and builds automatically across the network with every successful settlement.
                      </p>
                      <div className="flex gap-4">
                         <div className="flex-1 p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                            <span className="text-[9px] text-industrial-argent/40 block mb-2 uppercase tracking-widest">Global Rank</span>
                            <span className="text-2xl font-bold text-industrial-gold tracking-tighter tabular-nums italic">V-95</span>
                         </div>
                         <div className="flex-1 p-4 bg-industrial-border/10 rounded-sm border border-industrial-border">
                            <span className="text-[9px] text-industrial-argent/40 block mb-2 uppercase tracking-widest">Verified Tasks</span>
                            <span className="text-2xl font-bold text-industrial-argent tracking-tighter tabular-nums italic">SYNCING</span>
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Ticker */}
        <footer className="h-10 border-t border-industrial-border bg-industrial-base px-8 flex items-center justify-between relative z-10 overflow-hidden">
           <div className="text-[9px] font-bold tracking-[0.4em] text-industrial-argent/20 uppercase whitespace-nowrap">
             Sovereign Agent Commerce Flowing In Real-Time • Protocol State: Nominal • Settlement Active • Slashing Online • 
           </div>
           <div className="bg-industrial-base pl-4 text-[9px] font-bold text-industrial-argent/40 tracking-widest">
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
        active ? 'bg-industrial-argent text-industrial-base shadow-lg scale-[1.02]' : 'text-industrial-argent/40 hover:bg-industrial-border/20'
      }`}
    >
      <div className={`${active ? 'text-industrial-base' : 'text-industrial-argent'} transition-colors`}>{icon}</div>
      <span className="hidden md:block text-[10px] font-bold tracking-[0.3em] uppercase">{label}</span>
      {active && <div className="absolute left-0 w-1 h-1/2 bg-industrial-gold top-1/4" />}
    </button>
  )
}

function MetricCard({ label, value, sub, icon }: { label: string, value: string | number, subText?: string, icon?: any }) {
  return (
    <div className="industrial-panel p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        {icon}
      </div>
      <div className="flex flex-col gap-2 relative z-10">
        <span className="text-[10px] font-bold tracking-[0.3em] text-industrial-argent/40 uppercase">{label}</span>
        <span className="text-4xl font-bold tracking-tighter text-industrial-argent italic argent-glow tabular-nums uppercase">{value}</span>
        {sub && <span className="text-[9px] text-industrial-argent/20 tracking-widest uppercase mt-2">{sub}</span>}
      </div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1 bg-industrial-gold/10 group-hover:w-full transition-all duration-700" />
    </div>
  )
}

function ProtocolItem({ label, value, desc }: { label: string, value: string, desc: string }) {
  return (
    <div className="flex flex-col gap-3">
       <span className="text-[10px] font-bold text-industrial-argent tracking-widest underline decoration-industrial-gold decoration-2 underline-offset-4">{label}</span>
       <span className="text-lg font-bold text-industrial-argent italic">{value}</span>
       <p className="text-[9px] text-industrial-argent/30 leading-relaxed uppercase">{desc}</p>
    </div>
  )
}

function ContractEntry({ label, addr }: { label: string, addr: string }) {
  return (
    <div className="flex flex-col gap-1">
       <span className="text-[9px] font-bold text-industrial-argent/30 uppercase tracking-[0.2em]">{label}</span>
       <div className="flex items-center justify-between">
          <span className="text-[10px] text-industrial-argent font-mono uppercase bg-industrial-border/30 px-2 py-0.5 rounded-sm">{addr.slice(0, 8)}...{addr.slice(-6)}</span>
          <a href={`https://explorer.testnet.arc.network/address/${addr}`} target="_blank" className="text-industrial-argent/20 hover:text-industrial-gold transition-colors">
            <ChevronRight size={14} />
          </a>
       </div>
    </div>
  )
}

export default App
