import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistMono } from 'geist/font/mono';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'RemitChain',
  description: 'Production-grade cross-border remittance platform on Substrate.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body className="font-sans bg-[#09090b] text-white min-h-screen">{children}</body>
    </html>
  );
}
