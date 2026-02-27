import { stringToHex } from '@polkadot/util';

const DRIFT_KEY = 'remit:chain:drifted';
const EXPECTED_ACCOUNT = process.env.NEXT_PUBLIC_DEV_ACCOUNT_ADDRESS;

export type SigningPayload = {
  from: string;
  to: string;
  amount: string;
  assetId: string;
  corridor: string;
  nonce: number;
  deadline: number;
  chainId: string;
};

export type SignedPayload = SigningPayload & {
  signature: string;
  payload: string;
};

export function buildSigningPayload(payload: SigningPayload) {
  return [
    process.env.NEXT_PUBLIC_SIGNING_DOMAIN ?? 'remitchain',
    payload.chainId,
    process.env.NEXT_PUBLIC_SIGNING_ACTION ?? 'send',
    payload.from,
    payload.to,
    payload.amount,
    payload.assetId,
    payload.corridor,
    String(payload.nonce),
    String(payload.deadline),
  ].join(':');
}

export function getLocalNonce(address: string) {
  if (typeof window === 'undefined') {
    return 1;
  }

  const key = `remit:nonce:${address}`;
  const current = Number(window.localStorage.getItem(key) ?? '0');
  const next = Number.isNaN(current) ? 1 : current + 1;
  window.localStorage.setItem(key, String(next));
  return next;
}

export function setLocalNonce(address: string, value: number) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = `remit:nonce:${address}`;
  window.localStorage.setItem(key, String(value));
}

export async function getServerNonce(address: string) {
  try {
    const response = await fetch(`/api/nonce?address=${encodeURIComponent(address)}`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { nonce?: number };
    return typeof data.nonce === 'number' ? data.nonce : null;
  } catch {
    return null;
  }
}

export async function getChainHeadBlock() {
  try {
    const response = await fetch('/api/chain/head');
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { block?: number };
    return typeof data.block === 'number' ? data.block : null;
  } catch {
    return null;
  }
}

export async function signRemittancePayload(
  input: Omit<SigningPayload, 'nonce' | 'deadline' | 'chainId'> & {
    nonce?: number;
    deadline?: number;
    deadlineBlocks?: number;
    chainId?: string;
  },
  appName: string = 'RemitChain'
): Promise<SignedPayload> {
  if (typeof window !== 'undefined' && window.localStorage.getItem(DRIFT_KEY) === 'true') {
    throw new Error('Chain session changed. Reconnect wallet before signing.');
  }

  if (EXPECTED_ACCOUNT && input.from !== EXPECTED_ACCOUNT) {
    throw new Error(`Use assigned dev account ${EXPECTED_ACCOUNT} for remote mode.`);
  }

  const { web3Enable, web3Accounts, web3FromSource } = await import(
    '@polkadot/extension-dapp'
  );

  const extensions = await web3Enable(appName);
  if (!extensions || extensions.length === 0) {
    throw new Error('No Polkadot extension available');
  }

  const accounts = await web3Accounts();
  const account = accounts.find((acc) => acc.address === input.from);
  if (!account) {
    throw new Error('Account not found in extension');
  }

  const injector = await web3FromSource(account.meta.source);
  if (!injector?.signer?.signRaw) {
    throw new Error('Signer is not available for this account');
  }

  let nonce = input.nonce;
  if (nonce === undefined) {
    const serverNonce = await getServerNonce(input.from);
    if (serverNonce !== null) {
      nonce = serverNonce;
      setLocalNonce(input.from, nonce);
    } else {
      nonce = getLocalNonce(input.from);
    }
  }

  let deadline = input.deadline;
  if (deadline === undefined) {
    const head = await getChainHeadBlock();
    if (head === null) {
      throw new Error('Unable to fetch chain head for deadline');
    }
    const blocks = input.deadlineBlocks ?? 50;
    deadline = head + blocks;
  }

  const chainId = input.chainId ?? process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!chainId) {
    throw new Error('Chain ID not configured');
  }

  const payload: SigningPayload = {
    from: input.from,
    to: input.to,
    amount: input.amount,
    assetId: input.assetId,
    corridor: input.corridor,
    nonce,
    deadline,
    chainId,
  };

  const message = buildSigningPayload(payload);
  const signRaw = injector.signer.signRaw;
  const result = await signRaw({
    address: input.from,
    data: stringToHex(message),
    type: 'bytes',
  });

  return {
    ...payload,
    signature: result.signature,
    payload: message,
  };
}

