import { ArrowUpRight } from 'lucide-react';
import { CORRIDORS } from '@/lib/data';

export default function CorridorsPage() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">All Corridors</h1>
        <p className="text-zinc-500 max-w-2xl">
          Real-time pricing across active corridors. Rates update continuously from oracle feeds.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CORRIDORS.map((corridor) => (
          <div
            key={corridor.id}
            className="group relative p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-600 transition-all"
          >
            <div className="absolute top-5 right-5 text-zinc-700 group-hover:text-white transition-colors">
              <ArrowUpRight size={16} />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <img src={`https://flagcdn.com/40x30/${corridor.flag}.png`} alt={corridor.name} width={40} height={30} className="rounded-sm" />
              <div>
                <div className="text-xl font-bold text-white">{corridor.name}</div>
                <div className="text-sm text-zinc-500 font-mono">{corridor.id.toUpperCase()}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-zinc-500">Rate</div>
                <div className="text-lg font-semibold text-white">
                  1 USDC = {corridor.rate} {corridor.code}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Fee</div>
                <div className="text-lg font-semibold text-white">{corridor.fee}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

