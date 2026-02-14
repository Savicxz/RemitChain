import { cn } from '@/lib/utils';

export function KycBadge({ level }: { level: 0 | 1 | 2 | 3 }) {
  const isVerified = level >= 2;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          isVerified ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
        )}
      />
      <span className="text-xs font-mono text-zinc-300 tracking-wider">
        {isVerified ? 'KYC: VERIFIED' : 'KYC: PENDING'}
      </span>
    </div>
  );
}

