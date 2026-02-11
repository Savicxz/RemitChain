import { ApiPromise, WsProvider } from '@polkadot/api';
import fs from 'fs';


function loadChainTypes() {
  const raw = process.env.CHAIN_TYPES_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid CHAIN_TYPES_JSON');
    }
  }

  const typesPath = process.env.CHAIN_TYPES_PATH;
  if (typesPath && fs.existsSync(typesPath)) {
    const contents = fs.readFileSync(typesPath, 'utf-8');
    try {
      return JSON.parse(contents) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid JSON in types file: ${typesPath}`);
    }
  }

  return undefined;
}

let apiPromise: ApiPromise | null = null;
let apiProvider: WsProvider | null = null;

export async function getApi() {
  if (apiPromise && apiPromise.isConnected) {
    return apiPromise;
  }

  if (apiProvider) {
    try {
      apiProvider.disconnect();
    } catch {
      // Ignore cleanup errors; we'll recreate the provider below.
    }
    apiProvider = null;
    apiPromise = null;
  }

  const endpoint = process.env.CHAIN_WS_URL ?? 'wss://rpc.polkadot.io';
  const provider = new WsProvider(endpoint);
  const customTypes = loadChainTypes();
  provider.on('disconnected', () => {
    apiPromise = null;
    apiProvider = null;
  });
  provider.on('error', () => {
    apiPromise = null;
    apiProvider = null;
  });

  apiProvider = provider;
  apiPromise = await ApiPromise.create({ provider, types: customTypes });
  return apiPromise;
}

export type RemittancePayload = {
  from: string;
  to: string;
  amount: string;
  assetId: string;
  corridor: string;
  signature?: string;
  nonce?: number;
  deadline?: number;
  chainId?: string;
};

export async function submitRemittancePlaceholder(payload: RemittancePayload) {
  const api = await getApi();

  // TODO: Replace with actual pallet call + signer once chain is live.
  // Example:
  // const tx = api.tx.remitchain.sendRemittance(...);
  // const hash = await tx.signAndSend(signer);
  // return { hash };

  return {
    hash: `0xplaceholder_${Date.now()}`,
    status: 'QUEUED',
    payload,
  };
}
