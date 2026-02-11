'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SendFlow } from '@/components/features/send-flow';
import { CORRIDORS } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useWalletStore } from '@/store/use-wallet-store';

export default function OverviewPage() {
  const balances = useWalletStore((state) => state.balances);
  const primaryAssetId = useWalletStore((state) => state.primaryAssetId);
  const balance = balances[primaryAssetId] ?? 0;
  const txHistory = useWalletStore((state) => state.txHistory);
  const recordSend = useWalletStore((state) => state.recordSend);
  const [sendOpen, setSendOpen] = useState(false);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-20">
      <section>
        <span className="text-zinc-500 font-medium mb-4 block text-xs uppercase tracking-widest">
          Available Liquidity
        </span>
        <div className="flex items-baseline gap-4 mb-10">
          <h1 className="text-7xl md:text-8xl font-semibold tracking-tighter text-white">
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h1>
          <span className="text-2xl text-zinc-600 font-medium translate-y-[-4px]">{primaryAssetId}</span>
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

      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Live Corridors</h3>
          <span className="text-xs text-zinc-500 font-mono">UPDATED: JUST NOW</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {CORRIDORS.map((c) => (
            <div
              key={c.id}
              className="group relative p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-600 transition-all cursor-pointer active:scale-[0.98]"
              onClick={() => setSendOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setSendOpen(true);
              }}
            >
              <div className="absolute top-4 right-4 text-zinc-700 group-hover:text-white transition-colors">
                <ArrowUpRight size={16} />
              </div>
              <div className="flex flex-col h-full justify-between gap-6">
                <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all duration-300">
                  <img src={`https://flagcdn.com/40x30/${c.flag}.png`} alt={c.name} width={40} height={30} className="rounded-sm" />
                </span>
                <div>
                  <div className="font-bold text-white text-lg">{c.id.toUpperCase()}</div>
                  <div className="font-medium text-zinc-400 text-sm mb-1">{c.name}</div>
                  <div className="text-xs text-zinc-600 font-mono">
                    1 USD = {c.rate} {c.code}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold mb-6">Recent Settlement</h3>
        <div className="border-t border-zinc-800/50">
          {txHistory.map((tx) => (
            <div
              key={tx.id}
              className="py-5 flex items-center justify-between border-b border-zinc-800/50 group hover:bg-zinc-900/20 transition-colors px-4 -mx-4 rounded-lg"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                  {tx.amount.startsWith('+') ? (
                    <ArrowDownLeft size={18} className="text-zinc-400 group-hover:text-white" />
                  ) : (
                    <ArrowUpRight size={18} className="text-white" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-white">{tx.name}</div>
                  <div className="text-sm text-zinc-500 font-medium">
                    {tx.method} • {tx.time}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'font-bold tracking-tight text-lg',
                    tx.amount.startsWith('+') ? 'text-emerald-500' : 'text-white'
                  )}
                >
                  {tx.amount}
                </div>
                <div className="text-[10px] font-mono font-medium text-zinc-600 mt-1 uppercase tracking-wider">
                  {tx.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SendFlow
        open={sendOpen}
        close={() => setSendOpen(false)}
        onSent={(amount, recipient, meta) => {
          recordSend(amount, recipient, meta);
          setSendOpen(false);
        }}
      />
    </div>
  );
}

