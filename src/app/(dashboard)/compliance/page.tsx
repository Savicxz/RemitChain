'use client';

import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { useWalletStore } from '@/store/use-wallet-store';
import { cn } from '@/lib/utils';

export default function CompliancePage() {
  const kycLevel = useWalletStore((state) => state.kycLevel);
  const isVerified = kycLevel >= 2;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Compliance Status</h1>
        <p className="text-zinc-500 max-w-2xl">
          Your identity verification status determines your daily transfer limits and access to
          corridors.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Shield className="text-zinc-500" size={24} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500">KYC Level</div>
              <div className="text-xl font-bold text-white">Tier {kycLevel}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider',
                isVerified
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              )}
            >
              {isVerified ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {isVerified ? 'VERIFIED' : 'PENDING'}
            </span>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Daily Limit</div>
          <div className="text-3xl font-semibold text-white">
            {kycLevel === 1 && '$1,000'}
            {kycLevel === 2 && '$10,000'}
            {kycLevel === 3 && '$50,000+'}
          </div>
          <p className="text-zinc-500 text-sm">
            Upgrade your verification tier to unlock higher limits and additional corridors.
          </p>
        </div>
      </div>
    </div>
  );
}

