import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X, 
  Check, 
  ChevronDown, 
  Search, 
  Bell, 
  User, 
  Command,
  Activity,
  Globe,
  Shield,
  Zap,
  ChevronRight,
  Loader2,
  LogOut
} from 'lucide-react';

/**
 * RemitChain v2.3 - Cleaned & Refined
 * * Removed Watermark
 * * Adjusted Typography Scale
 * * Fixed Footer Layout
 */

// --- Configuration ---
const CORRIDORS = [
  { id: 'mx', name: 'Mexico', code: 'MXN', rate: 17.42, fee: 1.5, flag: '🇲🇽' },
  { id: 'in', name: 'India', code: 'INR', rate: 83.15, fee: 0.8, flag: '🇮🇳' },
  { id: 'ng', name: 'Nigeria', code: 'NGN', rate: 1540.0, fee: 2.1, flag: '🇳🇬' },
  { id: 'ph', name: 'Philippines', code: 'PHP', rate: 56.20, fee: 0.5, flag: '🇵🇭' },
  { id: 'vn', name: 'Vietnam', code: 'VND', rate: 24500, fee: 1.0, flag: '🇻🇳' },
];

const TRANSACTIONS = [
  { id: 1, name: 'Maria Gonzales', method: 'Sent to Mexico', amount: '-500.00', currency: 'USDC', status: 'Settled', time: '14:20' },
  { id: 2, name: 'Liquidty Prov. #4', method: 'Auto-Swap', amount: '+450.00', currency: 'USDC', status: 'Settled', time: '11:05' },
  { id: 3, name: 'Rahul Sharma', method: 'Sent to India', amount: '-1,200.00', currency: 'USDC', status: 'Processing', time: '09:30' },
];

// --- Primitives ---

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Button = ({ children, onClick, disabled, variant = 'primary', className = '', icon: Icon }) => {
  const base = "h-12 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const styles = {
    primary: "bg-white text-black hover:bg-zinc-200 border border-transparent",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700",
    outline: "border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 bg-transparent",
    ghost: "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, styles[variant], className)}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

// --- Branding ---

const OuroborosLogo = ({ className, size = 32 }) => (
  <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top segment - Lighter */}
      <path d="M4 4H20V8H8V20H4V4Z" fill="white" fillOpacity="0.9" />
      {/* Right segment - Medium */}
      <path d="M20 4V20H16V8H20Z" fill="white" fillOpacity="0.6" />
      {/* Bottom segment - Darker */}
      <path d="M20 20H4V16H16V20Z" fill="white" fillOpacity="0.4" />
      {/* Center gap implies the loop */}
    </svg>
  </div>
);

// --- Main Application ---

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [kycLevel, setKycLevel] = useState(1); // 1: Basic, 2: Verified
  const [balance, setBalance] = useState(14250.00);
  const [sendOpen, setSendOpen] = useState(false);
  const [txHistory, setTxHistory] = useState(TRANSACTIONS);
  const [activeTab, setActiveTab] = useState('overview');

  // Simulation: Auto-verify KYC after login
  useEffect(() => {
    if (isAuth) {
      const timer = setTimeout(() => setKycLevel(2), 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuth]);

  if (!isAuth) return <LandingPage onConnect={() => setIsAuth(true)} />;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-white selection:text-black relative overflow-hidden flex flex-col">
      
      {/* Removed Watermark for cleaner look */}

      {/* Top Navigation (Restored Layout) */}
      <nav className="sticky top-0 w-full h-20 border-b border-zinc-800/50 bg-[#09090b]/90 backdrop-blur-md flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <OuroborosLogo size={32} />
            <span className="text-lg font-bold tracking-tight text-white">RemitChain</span>
          </div>
          
          {/* Main Nav Links */}
          <div className="hidden md:flex items-center gap-2">
            {['overview', 'corridors', 'compliance'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize",
                  activeTab === tab 
                    ? "text-white bg-zinc-800" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className={`w-2 h-2 rounded-full ${kycLevel === 2 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-xs font-mono text-zinc-300 tracking-wider">
              {kycLevel === 2 ? 'KYC: VERIFIED' : 'KYC: PENDING'}
            </span>
          </div>
          
          <div className="h-8 w-px bg-zinc-800 mx-2 hidden md:block" />
          
          <button className="text-zinc-400 hover:text-white transition-colors" title="Logout" onClick={() => setIsAuth(false)}>
             <LogOut size={20} />
          </button>
          
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
             <User size={16} />
          </div>
        </div>
      </nav>

      <main className="flex-1 relative z-10 w-full max-w-6xl mx-auto px-6 pt-16 pb-20">
        
        {activeTab === 'overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-20">
            {/* Balance Section - Improved spacing */}
            <section>
              <span className="text-zinc-500 font-medium mb-4 block text-xs uppercase tracking-widest">Available Liquidity</span>
              <div className="flex items-baseline gap-4 mb-10">
                <h1 className="text-7xl md:text-8xl font-semibold tracking-tighter text-white">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h1>
                <span className="text-2xl text-zinc-600 font-medium translate-y-[-4px]">USDC</span>
              </div>
              
              <div className="flex gap-4">
                <Button onClick={() => setSendOpen(true)} className="w-40" icon={ArrowUpRight}>
                  Transfer
                </Button>
                <Button variant="secondary" className="w-40" icon={ArrowDownLeft}>
                  Add Funds
                </Button>
              </div>
            </section>

            {/* Quick Corridors */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Live Corridors</h3>
                <span className="text-xs text-zinc-500 font-mono">UPDATED: JUST NOW</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {CORRIDORS.map((c) => (
                  <div key={c.id} className="group relative p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-600 transition-all cursor-pointer active:scale-[0.98]" onClick={() => setSendOpen(true)}>
                    <div className="absolute top-4 right-4 text-zinc-700 group-hover:text-white transition-colors">
                      <ArrowUpRight size={16} />
                    </div>
                    <div className="flex flex-col h-full justify-between gap-6">
                      <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all duration-300">{c.flag}</span>
                      <div>
                        <div className="font-bold text-white text-lg">{c.id.toUpperCase()}</div>
                        <div className="font-medium text-zinc-400 text-sm mb-1">{c.name}</div>
                        <div className="text-xs text-zinc-600 font-mono">1 USD = {c.rate} {c.code}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Transaction History */}
            <section>
              <h3 className="text-lg font-bold mb-6">Recent Settlement</h3>
              <div className="border-t border-zinc-800/50">
                {txHistory.map((tx) => (
                  <div key={tx.id} className="py-5 flex items-center justify-between border-b border-zinc-800/50 group hover:bg-zinc-900/20 transition-colors px-4 -mx-4 rounded-lg">
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                        {tx.amount.startsWith('+') 
                          ? <ArrowDownLeft size={18} className="text-zinc-400 group-hover:text-white" /> 
                          : <ArrowUpRight size={18} className="text-white" />
                        }
                      </div>
                      <div>
                        <div className="font-bold text-white">{tx.name}</div>
                        <div className="text-sm text-zinc-500 font-medium">{tx.method} • {tx.time}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("font-bold tracking-tight text-lg", tx.amount.startsWith('+') ? 'text-emerald-500' : 'text-white')}>
                        {tx.amount}
                      </div>
                      <div className="text-[10px] font-mono font-medium text-zinc-600 mt-1 uppercase tracking-wider">{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'overview' && (
           <div className="h-[50vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95">
             <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
               <Shield className="text-zinc-600" size={32} />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2 capitalize">{activeTab} Module</h2>
             <p className="text-zinc-500 max-w-md">
               This permissioned module requires elevated admin access or a specific corridor license.
             </p>
             <Button variant="outline" className="mt-8" onClick={() => setActiveTab('overview')}>Back to Overview</Button>
           </div>
        )}

      </main>

      {/* Slide-over Send Modal */}
      {sendOpen && (
        <SendFlow 
          close={() => setSendOpen(false)} 
          balance={balance} 
          onSent={(amount, recipient) => {
            setBalance(b => b - amount);
            setTxHistory([
              { id: Date.now(), name: recipient, method: 'Sent International', amount: `-${amount.toFixed(2)}`, currency: 'USDC', status: 'Processing', time: 'Just Now' },
              ...txHistory
            ]);
            setSendOpen(false);
          }} 
        />
      )}
    </div>
  );
}

// --- Components: Landing ---

function LandingPage({ onConnect }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(onConnect, 1200);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#09090b] to-[#09090b]" />
      
      <div className="relative z-10 max-w-3xl w-full text-center space-y-12 animate-in fade-in duration-1000">
        
        {/* New Ouroboros Logo in Landing */}
        <div className="flex justify-center mb-8">
           <OuroborosLogo size={56} className="shadow-[0_0_60px_-10px_rgba(255,255,255,0.1)]" />
        </div>

        {/* Typography - Reduced Scale */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white leading-[0.95]">
          BORDERS ARE <br/>
          <span className="text-zinc-600">OBSOLETE.</span>
        </h1>

        <p className="text-zinc-400 text-lg font-light leading-relaxed max-w-md mx-auto">
          The first permissioned remittance protocol on Substrate. 
          Settlement in seconds, compliance by default.
        </p>

        <div className="pt-8 flex flex-col items-center gap-12">
          <Button onClick={handleConnect} className="w-full md:w-auto min-w-[200px] h-14 text-lg bg-white text-black hover:bg-zinc-200 border-none shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            {isConnecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={20} /> Connecting...
              </span>
            ) : 'Connect Wallet'}
          </Button>
          
          {/* Secured By Footer - Side by Side Fixed */}
          <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity duration-500">
             <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">Secured By</span>
             <div className="h-px w-6 bg-zinc-800" />
             <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-tight text-sm">
               <div className="w-2.5 h-2.5 rounded-full bg-[#E6007A]" /> {/* Polkadot Pink */}
               Polkadot
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Components: Send Flow ---

function SendFlow({ close, balance, onSent }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [selectedCorridor, setSelectedCorridor] = useState(CORRIDORS[0]);
  const [recipient, setRecipient] = useState('');

  const finalAmount = amount ? (parseFloat(amount) * selectedCorridor.rate).toLocaleString() : '0.00';
  const fee = amount ? (parseFloat(amount) * (selectedCorridor.fee / 100)).toFixed(2) : '0.00';

  const handleSend = () => {
    setStep(3);
    setTimeout(() => onSent(parseFloat(amount), recipient), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={close} />
      
      {/* Panel */}
      <div className="relative w-full max-w-md bg-[#09090b] border-l border-zinc-800 shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold tracking-tight">New Transfer</h2>
          <button onClick={close} className="p-2 hover:bg-zinc-800 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {step === 1 && (
          <div className="flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <label className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">Destination</label>
              <div className="grid grid-cols-1 gap-2">
                {CORRIDORS.slice(0, 3).map((c) => (
                  <button 
                    key={c.id} 
                    onClick={() => setSelectedCorridor(c)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-all",
                      selectedCorridor.id === c.id 
                        ? "bg-zinc-100 border-zinc-100 text-black" 
                        : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.flag}</span>
                      <span className="font-bold">{c.name}</span>
                    </div>
                    {selectedCorridor.id === c.id && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">Amount (USDC)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full bg-transparent border-b border-zinc-700 text-5xl font-semibold py-4 focus:outline-none focus:border-white placeholder:text-zinc-800 tabular-nums"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Available: ${balance.toLocaleString()}</span>
                {parseFloat(amount) > balance && <span className="text-red-500 font-medium">Insufficient funds</span>}
              </div>
            </div>

            <div className="mt-auto">
              <Button 
                onClick={() => setStep(2)} 
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance} 
                className="w-full h-14 text-lg"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 space-y-6 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Sending</span>
                <span className="text-xl font-medium tabular-nums">{amount} USDC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Rate</span>
                <span className="font-mono text-zinc-500 text-sm">1 USDC = {selectedCorridor.rate} {selectedCorridor.code}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Network Fee</span>
                <span className="text-zinc-300 tabular-nums">${fee}</span>
              </div>
              <div className="h-px bg-zinc-800 w-full" />
              <div>
                <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider block mb-1">Recipient Gets</span>
                <span className="text-3xl font-bold text-emerald-400 tabular-nums">{finalAmount} <span className="text-lg text-emerald-500/70 font-medium">{selectedCorridor.code}</span></span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <label className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">Recipient Name</label>
              <input 
                type="text" 
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="Enter full legal name"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 transition-colors text-lg"
              />
            </div>

            <div className="mt-auto space-y-3">
              <Button onClick={handleSend} disabled={!recipient} className="w-full h-14 text-lg">
                Confirm & Send
              </Button>
              <Button onClick={() => setStep(1)} variant="ghost" className="w-full">
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-2 border-zinc-800 flex items-center justify-center">
                <Globe className="text-zinc-700" size={40} />
              </div>
              <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 text-white">Settling on Substrate</h3>
              <p className="text-zinc-500 text-sm max-w-[200px] mx-auto leading-relaxed">Verifying zero-knowledge proofs and finalizing block...</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}