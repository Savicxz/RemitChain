'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { Button } from '@/components/ui/button';
import { connectPolkadotWallet } from '@/lib/polkadot';
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

      if (hasExtension) {
        if (!activeAccount) {
          setError('No Polkadot accounts found in the extension.');
          return;
        }
        connect(activeAccount.address);
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
      connect(accounts?.[0]);
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
