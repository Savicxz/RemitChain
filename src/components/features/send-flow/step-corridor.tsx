import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Corridor } from '@/lib/data';

export function StepCorridor({
  corridors,
  selected,
  onSelect,
}: {
  corridors: Corridor[];
  selected: Corridor;
  onSelect: (corridor: Corridor) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
        Destination
      </label>
      <div className="grid grid-cols-1 gap-2">
        {corridors.slice(0, 3).map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border transition-all',
              selected.id === c.id
                ? 'bg-zinc-100 border-zinc-100 text-black'
                : 'bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
            )}
          >
            <div className="flex items-center gap-3">
              <img src={`https://flagcdn.com/32x24/${c.flag}.png`} alt={c.name} width={32} height={24} className="rounded-sm" />
              <span className="font-bold">{c.name}</span>
            </div>
            {selected.id === c.id && <Check size={16} />}
          </button>
        ))}
      </div>
    </div>
  );
}

