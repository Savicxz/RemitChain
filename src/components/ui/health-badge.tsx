'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type HealthState = 'ok' | 'degraded' | 'down' | 'unknown';

const STATE_LABELS: Record<HealthState, string> = {
  ok: 'OK',
  degraded: 'DEGRADED',
  down: 'DOWN',
  unknown: 'CHECKING',
};

const STATE_STYLES: Record<HealthState, string> = {
  ok: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
  unknown: 'bg-zinc-500',
};

export function HealthBadge() {
  const [state, setState] = useState<HealthState>('unknown');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        if (!response.ok) {
          if (mounted) {
            setState('degraded');
          }
          return;
        }
        const data = (await response.json()) as { ok?: boolean };
        if (!mounted) return;
        setState(data.ok ? 'ok' : 'degraded');
      } catch {
        if (mounted) {
          setState('down');
        }
      }
    };

    load();
    const interval = window.setInterval(load, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-zinc-800/70 bg-zinc-900/60 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400"
      title="System health status"
    >
      <span className={cn('h-2 w-2 rounded-full', STATE_STYLES[state])} />
      <span>{STATE_LABELS[state]}</span>
    </div>
  );
}
