import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Radio } from 'lucide-react';

// @ts-ignore
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const HUB_URL = import.meta.env?.VITE_HUB_URL || (isLocal ? "http://localhost:8080" : "https://arc-agent-economy.onrender.com");

interface CryptoTick {
  tick: number;
  base_price: number;
  price: number;
  change_pct: number;
  timestamp: string;
}

interface PolyTick {
  tick: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  timestamp: string;
}

export function BloombergTerminal() {
  const [status, setStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [cryptoData, setCryptoData] = useState<{ token: string, ticks: CryptoTick[] }>({ token: '-', ticks: [] });
  const [polyData, setPolyData] = useState<{ eventId: string, ticks: PolyTick[] }>({ eventId: '-', ticks: [] });

  useEffect(() => {
    // Connect directly to the backend HUB_URL instead of the local hostname
    const sseUrl = `${HUB_URL}/api/admin-monitor`;
    
    console.log("Connecting to SSE:", sseUrl);
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => setStatus('CONNECTED');
    eventSource.onerror = () => setStatus('DISCONNECTED');

    eventSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'CRYPTO_TICK') {
          setCryptoData(prev => {
            if (prev.token !== msg.token) return { token: msg.token, ticks: [msg.data] };
            return { token: msg.token, ticks: [...prev.ticks, msg.data].slice(-30) }; 
          });
        } else if (msg.type === 'POLY_TICK') {
          setPolyData(prev => {
            if (prev.eventId !== msg.eventId) return { eventId: msg.eventId, ticks: [msg.data] };
            return { eventId: msg.eventId, ticks: [...prev.ticks, msg.data].slice(-30) };
          });
        }
      } catch (err) {}
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="industrial-panel p-4 flex justify-between items-center border-l-2 border-l-industrial-gold">
        <div className="flex items-center gap-3">
           <Radio size={16} className={status === 'CONNECTED' ? 'text-industrial-gold animate-pulse' : 'text-industrial-danger'} />
           <span className="text-[9px] font-bold tracking-[0.4em] uppercase text-industrial-argent/50">LIVE AGENT OBSERVATION DECK</span>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-industrial-gold' : 'bg-industrial-danger'}`} />
           <span className="text-[8px] font-bold italic tracking-widest uppercase text-industrial-argent/80">{status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRYPTO STREAM PANEL */}
        <div className="industrial-panel p-6 flex flex-col gap-4">
           <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                 <span className="text-[8px] tracking-[0.3em] font-bold text-industrial-argent/40 uppercase">Service 2</span>
                 <span className="text-sm font-bold text-industrial-argent italic uppercase argent-glow">Live Market Data</span>
              </div>
              <span className="text-[10px] bg-industrial-border/30 px-2 py-1 uppercase tracking-widest text-industrial-gold font-bold">
                 {cryptoData.token.toUpperCase()}
              </span>
           </div>

           <div className="h-64 bg-black/40 border border-industrial-border/30 rounded-sm p-4 relative">
              {cryptoData.ticks.length === 0 ? (
                 <div className="absolute inset-0 flex items-center justify-center text-[10px] text-industrial-argent/20 uppercase tracking-widest animate-pulse">
                    Awaiting Agent Stream...
                 </div>
              ) : (
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={cryptoData.ticks}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                     <XAxis dataKey="tick" stroke="#444" tick={{fontSize: 9}} tickFormatter={(v) => `T+${v}`} />
                     <YAxis domain={['auto', 'auto']} stroke="#444" tick={{fontSize: 9}} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                     <Tooltip 
                       contentStyle={{backgroundColor: '#050505', border: '1px solid #333', fontSize: '10px'}}
                       itemStyle={{color: '#EAB308'}}
                     />
                     <Line 
                       type="monotone" 
                       dataKey="price" 
                       stroke="#EAB308" 
                       strokeWidth={2}
                       dot={false}
                       isAnimationActive={false}
                     />
                   </LineChart>
                 </ResponsiveContainer>
              )}
           </div>

           <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col bg-industrial-border/10 p-2">
                 <span className="text-[7px] tracking-widest text-industrial-argent/40 uppercase">Latest Price</span>
                 <span className="text-xs font-bold text-industrial-gold tabular-nums">${cryptoData.ticks[cryptoData.ticks.length-1]?.price.toFixed(4) || '0.0000'}</span>
              </div>
              <div className="flex flex-col bg-industrial-border/10 p-2">
                 <span className="text-[7px] tracking-widest text-industrial-argent/40 uppercase">Tick Count</span>
                 <span className="text-xs font-bold text-industrial-argent tabular-nums">{cryptoData.ticks.length}</span>
              </div>
              <div className="flex flex-col bg-industrial-border/10 p-2">
                 <span className="text-[7px] tracking-widest text-industrial-argent/40 uppercase">Volatility</span>
                 <span className={`text-xs font-bold tabular-nums ${cryptoData.ticks[cryptoData.ticks.length-1]?.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {cryptoData.ticks[cryptoData.ticks.length-1]?.change_pct >= 0 ? '+' : ''}{cryptoData.ticks[cryptoData.ticks.length-1]?.change_pct || 0}%
                 </span>
              </div>
           </div>
        </div>

        {/* POLYMARKET STREAM PANEL */}
        <div className="industrial-panel p-6 flex flex-col gap-4">
           <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                 <span className="text-[8px] tracking-[0.3em] font-bold text-industrial-argent/40 uppercase">Service 7</span>
                 <span className="text-sm font-bold text-industrial-argent italic uppercase argent-glow">Arbitrage Spread</span>
              </div>
              <span className="text-[10px] bg-industrial-border/30 px-2 py-1 uppercase tracking-widest text-industrial-gold font-bold">
                 EVENT {polyData.eventId}
              </span>
           </div>

           <div className="h-64 bg-black/40 border border-industrial-border/30 rounded-sm p-4 relative">
              {polyData.ticks.length === 0 ? (
                 <div className="absolute inset-0 flex items-center justify-center text-[10px] text-industrial-argent/20 uppercase tracking-widest animate-pulse">
                    Awaiting Agent Stream...
                 </div>
              ) : (
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={polyData.ticks}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                     <XAxis dataKey="tick" stroke="#444" tick={{fontSize: 9}} tickFormatter={(v) => `T+${v}`} />
                     <YAxis domain={['auto', 'auto']} stroke="#444" tick={{fontSize: 9}} tickFormatter={(v) => `${(v*100).toFixed(0)}¢`} />
                     <Tooltip 
                       contentStyle={{backgroundColor: '#050505', border: '1px solid #333', fontSize: '10px'}}
                     />
                     <Line type="stepAfter" dataKey="bestAsk" stroke="#ef4444" strokeWidth={2} dot={false} name="Ask (Red)" isAnimationActive={false} />
                     <Line type="stepAfter" dataKey="bestBid" stroke="#22c55e" strokeWidth={2} dot={false} name="Bid (Green)" isAnimationActive={false} />
                   </LineChart>
                 </ResponsiveContainer>
              )}
           </div>

           <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col bg-industrial-border/10 p-2 border-b-2 border-b-green-500">
                 <span className="text-[7px] tracking-widest text-industrial-argent/40 uppercase">Best Bid</span>
                 <span className="text-xs font-bold text-green-500 tabular-nums">{(polyData.ticks[polyData.ticks.length-1]?.bestBid || 0).toFixed(4)}</span>
              </div>
              <div className="flex flex-col bg-industrial-border/10 p-2 border-b-2 border-b-red-500">
                 <span className="text-[7px] tracking-widest text-industrial-argent/40 uppercase">Best Ask</span>
                 <span className="text-xs font-bold text-red-500 tabular-nums">{(polyData.ticks[polyData.ticks.length-1]?.bestAsk || 0).toFixed(4)}</span>
              </div>
              <div className="flex flex-col bg-industrial-border/10 p-2 border-b-2 border-b-industrial-gold">
                 <span className="text-[7px] tracking-widest text-industrial-argent/40 uppercase">Spread</span>
                 <span className="text-xs font-bold text-industrial-gold tabular-nums">{(polyData.ticks[polyData.ticks.length-1]?.spread || 0).toFixed(4)}</span>
              </div>
           </div>
        </div>
      </div>
      <div className="p-4 bg-industrial-border/10 text-[9px] text-industrial-argent/40 font-mono">
        <span className="text-industrial-gold">HOW THIS WORKS:</span> When an agent runs <code className="text-industrial-base bg-industrial-argent/60 px-1 py-0.5 rounded-sm">npm run demo</code> in the command line, it purchases a stream of tick data via X402 Nano-Payments. 
        This dashboard connects to the backend and visualizes the exact same live tick data that the agent is paying for in real-time.
      </div>
    </div>
  );
}
