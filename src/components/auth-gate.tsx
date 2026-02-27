'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/use-wallet-store';
import { ChainSessionGuard } from '@/components/chain-session-guard';

export function AuthGate({ children }: { children: ReactNode }) {
  const isAuth = useWalletStore((state) => state.isAuth);
  const isHydrating = useWalletStore((state) => state.isHydrating);
  const hydrateSession = useWalletStore((state) => state.hydrateSession);
  const loadPortfolio = useWalletStore((state) => state.loadPortfolio);
  const router = useRouter();

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (!isHydrating && !isAuth) {
      router.replace('/login');
    }
  }, [isAuth, isHydrating, router]);

  useEffect(() => {
    if (!isHydrating && isAuth) {
      loadPortfolio();
    }
  }, [isAuth, isHydrating, loadPortfolio]);

  if (isHydrating || !isAuth) {
    return null;
  }

  return (
    <>
      <ChainSessionGuard />
      {children}
    </>
  );
}

