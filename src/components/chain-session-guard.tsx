'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/use-wallet-store';

const GENESIS_KEY = 'remit:chain:genesisHash';
const DRIFT_KEY = 'remit:chain:drifted';

type SessionState = {
  current: string;
  previous: string;
};

export function ChainSessionGuard() {
  const [mismatch, setMismatch] = useState<SessionState | null>(null);
  const disconnect = useWalletStore((state) => state.disconnect);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch('/api/chain/session', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { genesisHash?: string };
        const currentHash = data.genesisHash;
        if (!currentHash || cancelled || typeof window === 'undefined') {
          return;
        }

        const previousHash = window.localStorage.getItem(GENESIS_KEY);
        if (previousHash && previousHash !== currentHash) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith('remit:nonce:')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((key) => window.localStorage.removeItem(key));
          window.localStorage.setItem(DRIFT_KEY, 'true');
          window.localStorage.setItem(GENESIS_KEY, currentHash);
          setMismatch({ current: currentHash, previous: previousHash });
          return;
        }

        window.localStorage.setItem(GENESIS_KEY, currentHash);
        window.localStorage.removeItem(DRIFT_KEY);
      } catch {
        // ignore transient failures in background checks
      }
    }

    checkSession();
    const interval = window.setInterval(checkSession, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!mismatch) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-md rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-200 shadow-lg backdrop-blur">
      <p className="font-semibold">Chain session changed</p>
      <p className="mt-2 text-xs text-amber-100/90">
        Genesis hash changed from <code>{mismatch.previous.slice(0, 10)}...</code> to{' '}
        <code>{mismatch.current.slice(0, 10)}...</code>. Reconnect your wallet before sending.
      </p>
      <button
        type="button"
        className="mt-3 rounded bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/30"
        onClick={async () => {
          await disconnect();
          router.push('/login');
        }}
      >
        Reconnect Wallet
      </button>
    </div>
  );
}
