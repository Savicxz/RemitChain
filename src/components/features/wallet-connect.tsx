'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { Button } from '@/components/ui/button';
import { connectPolkadotWallet, signPolkadotMessage } from '@/lib/polkadot';
import { useWalletStore } from '@/store/use-wallet-store';

export function WalletConnectButton({ className }: { className?: string }) {
  const router = useRouter();
  const connect = useWalletStore((state) => state.connect);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      const { activeAccount, hasExtension } = await connectPolkadotWallet();

      if (hasExtension && !activeAccount) {
        setError('No Polkadot accounts found in the extension.');
        return;
      }

      if (hasExtension && activeAccount) {
        const nonceRes = await fetch(
          `/api/auth/nonce?address=${encodeURIComponent(activeAccount.address)}`
        );
        if (!nonceRes.ok) {
          setError('Failed to start wallet login.');
          return;
        }
        const { message } = (await nonceRes.json()) as { message?: string };
        if (!message) {
          setError('Login message missing from server.');
          return;
        }

        const signature = await signPolkadotMessage(activeAccount.address, message);
        const verifyRes = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: activeAccount.address, signature }),
        });

        if (!verifyRes.ok) {
          setError('Wallet signature was rejected.');
          return;
        }

        const data = (await verifyRes.json()) as { address?: string; kycTier?: number };
        connect(data.address ?? activeAccount.address, (data.kycTier ?? 0) as 0 | 1 | 2 | 3);
        router.push('/');
        return;
      }

      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        setError('WalletConnect project ID is not configured.');
        return;
      }

      const provider = await EthereumProvider.init({
        projectId,
        chains: [1],
        showQrModal: true,
        rpcMap: {
          1: 'https://cloudflare-eth.com',
        },
      });

      const accounts = await provider.enable();
      const account = accounts?.[0];
      if (!account) {
        setError('No wallet account returned by WalletConnect.');
        return;
      }

      const nonceRes = await fetch(`/api/auth/nonce?address=${encodeURIComponent(account)}`);
      if (!nonceRes.ok) {
        setError('Failed to start wallet login.');
        return;
      }

      const { message } = (await nonceRes.json()) as { message?: string };
      if (!message) {
        setError('Login message missing from server.');
        return;
      }

      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, account],
      })) as string;

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account, signature }),
      });

      if (!verifyRes.ok) {
        setError('Wallet signature was rejected.');
        return;
      }

      const data = (await verifyRes.json()) as { address?: string; kycTier?: number };
      connect(data.address ?? account, (data.kycTier ?? 0) as 0 | 1 | 2 | 3);
      router.push('/');
    } catch (err) {
      setError('Wallet connection failed. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <Button onClick={handleConnect} className={className} disabled={isConnecting}>
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={20} /> Connecting...
          </span>
        ) : (
          'Connect Wallet'
        )}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
