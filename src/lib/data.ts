export type Corridor = {
  id: string;
  name: string;
  code: string;
  rate: number;
  fee: number;
  flag: string;
};

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
};

export type Transaction = {
  id: string | number;
  name: string;
  method: string;
  amount: string;
  currency: string;
  status: string;
  time: string;
};

/** Returns an SVG flag image URL for a 2-letter country code. */
export function getFlagUrl(countryCode: string, size: number = 40) {
  return `https://flagcdn.com/${size}x${Math.round(size * 0.75)}/${countryCode.toLowerCase()}.png`;
}

export const CORRIDORS: Corridor[] = [
  { id: 'mx', name: 'Mexico', code: 'MXN', rate: 17.42, fee: 1.5, flag: 'mx' },
  { id: 'in', name: 'India', code: 'INR', rate: 83.15, fee: 0.8, flag: 'in' },
  { id: 'ng', name: 'Nigeria', code: 'NGN', rate: 1540.0, fee: 2.1, flag: 'ng' },
  { id: 'ph', name: 'Philippines', code: 'PHP', rate: 56.2, fee: 0.5, flag: 'ph' },
  { id: 'vn', name: 'Vietnam', code: 'VND', rate: 24500, fee: 1.0, flag: 'vn' },
];

export const ASSETS: Asset[] = [
  { id: 'USDC', symbol: 'USDC', name: 'USD Coin', decimals: 2 },
  { id: 'USDT', symbol: 'USDT', name: 'Tether', decimals: 2 },
  { id: 'DAI', symbol: 'DAI', name: 'Dai', decimals: 2 },
  { id: 'JMYR', symbol: 'jMYR', name: 'JPY-backed MYR', decimals: 2 },
  { id: 'JPHP', symbol: 'jPHP', name: 'JPY-backed PHP', decimals: 2 },
];

export const DEFAULT_ASSET_ID = ASSETS[0]?.id ?? 'USDC';

export const TRANSACTIONS: Transaction[] = [
  {
    id: 1,
    name: 'Maria Gonzales',
    method: 'Sent to Mexico',
    amount: '-500.00',
    currency: 'USDC',
    status: 'Settled',
    time: '14:20',
  },
  {
    id: 2,
    name: 'Liquidty Prov. #4',
    method: 'Auto-Swap',
    amount: '+450.00',
    currency: 'USDC',
    status: 'Settled',
    time: '11:05',
  },
  {
    id: 3,
    name: 'Rahul Sharma',
    method: 'Sent to India',
    amount: '-1,200.00',
    currency: 'USDC',
    status: 'Processing',
    time: '09:30',
  },
];

