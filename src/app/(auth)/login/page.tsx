'use client';

import { OuroborosLogo } from '@/components/ui/logo';
import { WalletConnectButton } from '@/components/features/wallet-connect';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#09090b] to-[#09090b]" />

      <div className="relative z-10 max-w-3xl w-full text-center space-y-12 animate-in fade-in duration-1000">
        <div className="flex justify-center mb-8">
          <OuroborosLogo
            size={56}
            className="shadow-[0_0_60px_-10px_rgba(255,255,255,0.1)]"
          />
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white leading-[0.95]">
          BORDERS ARE <br />
          <span className="text-zinc-600">OBSOLETE.</span>
        </h1>

        <p className="text-zinc-400 text-lg font-light leading-relaxed max-w-md mx-auto">
          The first permissioned remittance protocol on Substrate. Settlement in seconds, compliance
          by default.
        </p>

        <div className="pt-8 flex flex-col items-center gap-12">
          <WalletConnectButton className="w-full md:w-auto min-w-[200px] h-14 text-lg bg-white text-black hover:bg-zinc-200 border-none shadow-[0_0_20px_rgba(255,255,255,0.05)]" />

          <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
              Secured By
            </span>
            <div className="h-px w-6 bg-zinc-800" />
            <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-tight text-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-[#E6007A]" />
              Polkadot
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

