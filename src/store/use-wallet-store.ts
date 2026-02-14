import { create } from 'zustand';
import { ASSETS, DEFAULT_ASSET_ID, type Transaction } from '@/lib/data';

export type KycLevel = 0 | 1 | 2 | 3;

type SendMeta = {
  id?: string;
  status?: string;
  assetId?: string;
};

const DEFAULT_BALANCES: Record<string, number> = ASSETS.reduce((acc, asset) => {
  acc[asset.id] = 0;
  return acc;
}, {} as Record<string, number>);

type WalletState = {
  isAuth: boolean;
  isHydrating: boolean;
  kycLevel: KycLevel;
  balances: Record<string, number>;
  primaryAssetId: string;
  txHistory: Transaction[];
  activeAccount?: string;
  connect: (account?: string, kycLevel?: KycLevel) => void;
  disconnect: () => Promise<void>;
  hydrateSession: () => Promise<void>;
  loadPortfolio: () => Promise<void>;
  setKycLevel: (level: KycLevel) => void;
  setBalance: (assetId: string, balance: number) => void;
  setPrimaryAssetId: (assetId: string) => void;
  addTransaction: (tx: Transaction) => void;
  recordSend: (amount: number, recipient: string, meta?: SendMeta) => void;
  updateTransactionStatus: (id: string | number, status: string) => void;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  isAuth: false,
  isHydrating: false,
  kycLevel: 0,
  balances: DEFAULT_BALANCES,
  primaryAssetId: DEFAULT_ASSET_ID,
  txHistory: [],
  activeAccount: undefined,
  connect: (account, kycLevel = 0) =>
    set({ isAuth: true, activeAccount: account, kycLevel }),
  disconnect: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout errors
    }
    set({
      isAuth: false,
      kycLevel: 0,
      activeAccount: undefined,
      balances: DEFAULT_BALANCES,
      primaryAssetId: DEFAULT_ASSET_ID,
      txHistory: [],
    });
  },
  hydrateSession: async () => {
    set({ isHydrating: true });
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        set({ isAuth: false, activeAccount: undefined, isHydrating: false });
        return;
      }
      const data = (await response.json()) as {
        address?: string;
        kycTier?: number;
      };
      if (data.address) {
        set({
          isAuth: true,
          activeAccount: data.address,
        kycLevel: (data.kycTier ?? 0) as KycLevel,
          isHydrating: false,
        });
      } else {
        set({ isAuth: false, activeAccount: undefined, isHydrating: false });
      }
    } catch {
      set({ isAuth: false, activeAccount: undefined, isHydrating: false });
    }
  },
  loadPortfolio: async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        balances?: Record<string, number>;
        transactions?: Transaction[];
      };
      if (data.balances) {
        set((state) => ({
          balances: { ...state.balances, ...data.balances },
        }));
      }
      if (data.transactions) {
        set({ txHistory: data.transactions });
      }
    } catch {
      // ignore load errors
    }
  },
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
