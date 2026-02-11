'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OuroborosLogo } from '@/components/ui/logo';
import { KycBadge } from '@/components/ui/badge';
import { HealthBadge } from '@/components/ui/health-badge';
import { useWalletStore } from '@/store/use-wallet-store';

const NAV_ITEMS = [
  { href: '/', label: 'overview' },
  { href: '/corridors', label: 'corridors' },
  { href: '/compliance', label: 'compliance' },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const kycLevel = useWalletStore((state) => state.kycLevel);
  const disconnect = useWalletStore((state) => state.disconnect);

  const handleLogout = () => {
    disconnect();
    router.push('/login');
  };

  return (
    <nav className="sticky top-0 w-full h-20 border-b border-zinc-800/50 bg-[#09090b]/90 backdrop-blur-md flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-3">
          <OuroborosLogo size={32} />
          <span className="text-lg font-bold tracking-tight text-white">RemitChain</span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize',
                  isActive
                    ? 'text-white bg-zinc-800'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-3">
          <HealthBadge />
          <KycBadge level={kycLevel} />
        </div>

        <div className="h-8 w-px bg-zinc-800 mx-2 hidden md:block" />

        <button
          className="text-zinc-400 hover:text-white transition-colors"
          title="Logout"
          onClick={handleLogout}
        >
          <LogOut size={20} />
        </button>

        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
          <User size={16} />
        </div>
      </div>
    </nav>
  );
}

