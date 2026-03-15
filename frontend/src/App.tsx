import { useArcEconomy } from './hooks/useArcEconomy';
import { Terminal, Activity, Shield, Box, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

function App() {
  const { stats, events } = useArcEconomy();

  return (
    <div className="min-h-screen bg-[#050505] p-6 text-white overflow-hidden relative">
      {/* Background Grids */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#00ffaa 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-arc-neon/20 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-arc-neon" />
          <h1 className="text-2xl font-bold tracking-tighter glow-text">ARC ARGENT OBSERVER</h1>
        </div>
        <div className="flex items-center gap-6 text-xs text-arc-neon/60 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-arc-neon animate-pulse" />
            LIVE NETWORK: ARC TESTNET
          </div>
          <div>MODE: PURE OBSERVER</div>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6 relative z-10">
        {/* Left Col: Statistics */}
        <div className="col-span-3 space-y-6">
          <StatBox icon={<Box className="w-5 h-5 text-arc-neon" />} label="TOTAL MACHINE TASKS" value={stats.totalTasks} />
          <StatBox icon={<Zap className="w-5 h-5 text-arc-neon" />} label="TVL IN ESCROW" value={`${stats.tvl} USDC`} />
          
          <div className="bg-arc-gray/50 border border-arc-neon/10 p-4 rounded-lg">
            <h3 className="text-[10px] text-arc-neon/40 mb-4 tracking-[0.2em] uppercase font-bold">Protocol Nodes</h3>
            <div className="space-y-3">
              <NodeStatus label="Registry" address="0x7000...52f9" status="ONLINE" />
              <NodeStatus label="Escrow" address="0x5708...981b" status="ONLINE" />
            </div>
          </div>
        </div>

        {/* Center Col: Activity Pulse */}
        <div className="col-span-6 bg-arc-gray/30 border border-arc-neon/10 rounded-xl overflow-hidden flex flex-col h-[70vh]">
          <div className="bg-arc-neon/5 p-3 border-b border-arc-neon/10 flex items-center gap-2">
            <Activity className="w-4 h-4 text-arc-neon" />
            <span className="text-[10px] tracking-widest text-arc-neon">NETWORK PULSE</span>
          </div>
          <div className="flex-1 p-4 terminal-scroll overflow-y-auto space-y-3 font-mono text-sm">
            {events.length === 0 ? (
              <div className="text-arc-neon/20 animate-pulse">Waiting for autonomous activity...</div>
            ) : (
              events.map((e) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  key={e.id} 
                  className="flex gap-4 border-l-2 border-arc-neon/20 pl-4 py-1"
                >
                  <span className="text-arc-neon/40 shrink-0">[{e.timestamp}]</span>
                  <span className="text-arc-neon/90">{e.message}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Manifest */}
        <div className="col-span-3 space-y-6">
           <div className="bg-arc-gray/50 border border-arc-neon/10 p-6 rounded-lg h-full">
              <div className="flex items-center gap-2 mb-6">
                <Terminal className="w-5 h-5 text-arc-neon" />
                <h3 className="text-xs tracking-widest text-arc-neon uppercase">System Manifest</h3>
              </div>
              <p className="text-xs leading-relaxed text-arc-neon/60 italic">
                Zero-input observation node. Monitor machine-to-machine commerce on the ARC network. No human intervention required. Logic remains decentralized.
              </p>
           </div>
        </div>
      </main>

      {/* Footer / Ticker */}
      <footer className="mt-12 text-[10px] text-arc-neon/20 flex justify-between border-t border-arc-neon/10 pt-4">
        <div>© 2026 ARC AGENT ECONOMY PROTOCOL</div>
        <div className="tracking-[0.5em]">DECENTRALIZED INTELLIGENCE FLOWING</div>
      </footer>
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: any, label: string, value: string | number }) {
  return (
    <div className="bg-arc-gray/50 border border-arc-neon/10 p-6 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] tracking-widest text-arc-neon/40 uppercase font-bold">{label}</span>
      </div>
      <div className="text-2xl font-bold text-arc-neon glow-text tracking-tighter">{value}</div>
    </div>
  )
}

function NodeStatus({ label, address, status }: { label: string, address: string, status: string }) {
  return (
    <div className="flex justify-between items-center group">
      <div>
        <div className="text-[10px] text-white/80">{label}</div>
        <div className="text-[9px] text-arc-neon/30 font-mono tracking-tighter">{address}</div>
      </div>
      <div className="text-[10px] text-arc-neon font-bold px-2 py-0.5 rounded border border-arc-neon/20 bg-arc-neon/5">{status}</div>
    </div>
  )
}

export default App
