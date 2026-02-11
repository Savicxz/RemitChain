import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#18181b',
        subtle: '#27272a',
        primary: '#ffffff',
        secondary: '#a1a1aa',
        emerald: { 500: '#10b981' },
        amber: { 500: '#f59e0b' },
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-geist-mono)'],
      },
      letterSpacing: {
        tight: '-0.025em',
        tighter: '-0.05em',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

