'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/use-wallet-store';

export function AuthGate({ children }: { children: ReactNode }) {
  const isAuth = useWalletStore((state) => state.isAuth);
  const kycLevel = useWalletStore((state) => state.kycLevel);
  const setKycLevel = useWalletStore((state) => state.setKycLevel);
  const router = useRouter();

  useEffect(() => {
    if (!isAuth) {
      router.replace('/login');
    }
  }, [isAuth, router]);

  useEffect(() => {
    if (!isAuth || kycLevel !== 1) {
      return undefined;
    }

    const timer = setTimeout(() => setKycLevel(2), 3000);
    return () => clearTimeout(timer);
  }, [isAuth, kycLevel, setKycLevel]);

  if (!isAuth) {
    return null;
  }

  return <>{children}</>;
}

