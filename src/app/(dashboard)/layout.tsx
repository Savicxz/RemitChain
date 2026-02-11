import type { ReactNode } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { TopNav } from '@/components/top-nav';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-white selection:text-black relative overflow-hidden flex flex-col">
      <AuthGate>
        <TopNav />
        <main className="flex-1 relative z-10 w-full max-w-6xl mx-auto px-6 pt-16 pb-20">
          {children}
        </main>
      </AuthGate>
    </div>
  );
}
