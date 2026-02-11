import { create } from 'zustand';
import { ASSETS, DEFAULT_ASSET_ID, TRANSACTIONS, type Transaction } from '@/lib/data';

export type KycLevel = 1 | 2 | 3;

type SendMeta = {
  id?: string;
  status?: string;
  assetId?: string;
};

const DEFAULT_BALANCES: Record<string, number> = ASSETS.reduce(
  (acc, asset) => {
    if (asset.id === DEFAULT_ASSET_ID) {
      acc[asset.id] = 14250;
    } else {
      acc[asset.id] = 5200;
    }
    return acc;
  },
  {} as Record<string, number>
);

type WalletState = {
  isAuth: boolean;
  kycLevel: KycLevel;
  balances: Record<string, number>;
  primaryAssetId: string;
  txHistory: Transaction[];
  activeAccount?: string;
  connect: (account?: string) => void;
  disconnect: () => void;
  setKycLevel: (level: KycLevel) => void;
  setBalance: (assetId: string, balance: number) => void;
  setPrimaryAssetId: (assetId: string) => void;
  addTransaction: (tx: Transaction) => void;
  recordSend: (amount: number, recipient: string, meta?: SendMeta) => void;
  updateTransactionStatus: (id: string | number, status: string) => void;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  isAuth: false,
  kycLevel: 1,
  balances: DEFAULT_BALANCES,
  primaryAssetId: DEFAULT_ASSET_ID,
  txHistory: TRANSACTIONS,
  activeAccount: undefined,
  connect: (account) => set({ isAuth: true, activeAccount: account }),
  disconnect: () =>
    set({
      isAuth: false,
      kycLevel: 1,
      activeAccount: undefined,
      balances: DEFAULT_BALANCES,
      primaryAssetId: DEFAULT_ASSET_ID,
      txHistory: TRANSACTIONS,
    }),
  setKycLevel: (level) => set({ kycLevel: level }),
  setBalance: (assetId, balance) =>
    set((state) => ({ balances: { ...state.balances, [assetId]: balance } })),
  setPrimaryAssetId: (assetId) => set({ primaryAssetId: assetId }),
  addTransaction: (tx) => set((state) => ({ txHistory: [tx, ...state.txHistory] })),
  recordSend: (amount, recipient, meta) => {
    const state = get();
    const assetId = meta?.assetId ?? state.primaryAssetId;
    const currentBalance = state.balances[assetId] ?? 0;
    const nextBalance = Math.max(0, currentBalance - amount);
    const id = meta?.id ?? `tx_${Date.now()}`;
    const status = meta?.status ?? 'Processing';
    const newTx: Transaction = {
      id,
      name: recipient,
      method: 'Sent International',
      amount: `-${amount.toFixed(2)}`,
      currency: assetId,
      status,
      time: 'Just Now',
    };

    set({
      balances: { ...state.balances, [assetId]: nextBalance },
      txHistory: [newTx, ...state.txHistory],
    });
  },
  updateTransactionStatus: (id, status) =>
    set((state) => ({
      txHistory: state.txHistory.map((tx) =>
        String(tx.id) === String(id) ? { ...tx, status } : tx
      ),
    })),
}));
