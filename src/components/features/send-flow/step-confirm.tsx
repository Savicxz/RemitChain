import { Button } from '@/components/ui/button';
import type { Corridor } from '@/lib/data';

export function StepConfirm({
  amount,
  fee,
  finalAmount,
  corridor,
  recipient,
  setRecipient,
  onBack,
  onConfirm,
  signingError,
  debug,
  isSubmitting,
  assetSymbol,
  canSubmit,
}: {
  amount: string;
  fee: string;
  finalAmount: string;
  corridor: Corridor;
  recipient: string;
  setRecipient: (value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  signingError?: string | null;
  debug?: string;
  isSubmitting?: boolean;
  assetSymbol: string;
  canSubmit: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 space-y-6 mb-8">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Sending</span>
          <span className="text-xl font-medium tabular-nums">
            {amount} {assetSymbol}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Rate</span>
          <span className="font-mono text-zinc-500 text-sm">
            1 {assetSymbol} = {corridor.rate} {corridor.code}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Network Fee</span>
          <span className="text-zinc-300 tabular-nums">
            {fee} {assetSymbol}
          </span>
        </div>
        <div className="h-px bg-zinc-800 w-full" />
        <div>
          <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider block mb-1">
            Recipient Gets
          </span>
          <span className="text-3xl font-bold text-emerald-400 tabular-nums">
            {finalAmount}{' '}
            <span className="text-lg text-emerald-500/70 font-medium">{corridor.code}</span>
          </span>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <label className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
          Recipient Name
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="Enter full legal name"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 transition-colors text-lg"
        />
      </div>

      <div className="mt-auto space-y-3">
        {signingError && <div className="text-xs text-red-400">{signingError}</div>}
        <Button
          onClick={onConfirm}
          disabled={!recipient || isSubmitting || !canSubmit}
          className="w-full h-14 text-lg"
        >
          Confirm & Send
        </Button>
        <Button onClick={onBack} variant="ghost" className="w-full">
          Back
        </Button>
        {debug && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-[10px] font-mono text-zinc-400 whitespace-pre-wrap break-words">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
              Signature Debug
            </div>
            {debug}
          </div>
        )}
      </div>
    </div>
  );
}
