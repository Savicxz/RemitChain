import type { ChangeEvent } from 'react';
import type { Asset } from '@/lib/data';

const AMOUNT_INPUT_REGEX = /^\d*\.?\d{0,2}$/;

export function StepAmount({
  amount,
  setAmount,
  balance,
  asset,
  assets,
  onAssetChange,
  error,
}: {
  amount: string;
  setAmount: (value: string) => void;
  balance: number;
  asset: Asset;
  assets: Asset[];
  onAssetChange: (assetId: string) => void;
  error?: string | null;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.replace(/,/g, '');
    if (nextValue === '' || AMOUNT_INPUT_REGEX.test(nextValue)) {
      setAmount(nextValue);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
          Amount
        </label>
        <select
          value={asset.id}
          onChange={(event) => onAssetChange(event.target.value)}
          className="bg-zinc-900/60 border border-zinc-800 text-xs uppercase tracking-widest px-3 py-2 rounded-full text-zinc-200 focus:outline-none focus:border-zinc-500"
        >
          {assets.map((option) => (
            <option key={option.id} value={option.id} className="text-zinc-900">
              {option.symbol}
            </option>
          ))}
        </select>
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={handleChange}
          placeholder="0.00"
          autoFocus
          className="w-full bg-transparent border-b border-zinc-700 text-5xl font-semibold py-4 focus:outline-none focus:border-white placeholder:text-zinc-800 tabular-nums"
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">
          Available: {balance.toLocaleString()} {asset.symbol}
        </span>
        {error && <span className="text-red-500 font-medium">{error}</span>}
      </div>
    </div>
  );
}
