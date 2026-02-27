#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

function parseArgs(argv) {
  const out = { outPath: '', configPath: '', endpoint: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      out.outPath = argv[i + 1] ?? '';
      i += 1;
    } else if (arg === '--config') {
      out.configPath = argv[i + 1] ?? '';
      i += 1;
    } else if (arg === '--endpoint') {
      out.endpoint = argv[i + 1] ?? '';
      i += 1;
    }
  }
  return out;
}

function loadIdentityConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  return Array.isArray(parsed.teammates) ? parsed.teammates : [];
}

function parseContractsEnv() {
  const raw = process.env.REMOTE_CONTRACTS_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function deriveIdentities(teammates) {
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });

  return teammates
    .filter((entry) => entry && entry.id && entry.seed)
    .map((entry) => {
      const pair = keyring.addFromUri(String(entry.seed));
      return {
        id: String(entry.id),
        devIndex: Number(entry.devIndex ?? 0),
        seed: String(entry.seed),
        address: pair.address,
      };
    });
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv.slice(2));
  const endpoint = args.endpoint || process.env.CHAIN_WS_URL || 'ws://127.0.0.1:9944';
  const configPath =
    args.configPath || process.env.DEV_IDENTITIES_PATH || path.join(root, 'config', 'dev-identities.json');

  const provider = new WsProvider(endpoint);
  const api = await ApiPromise.create({ provider });

  const block = await api.query.system.number();
  const runtimeVersion = api.runtimeVersion;

  const teammates = loadIdentityConfig(configPath);
  const derived = await deriveIdentities(teammates);

  const status = {
    seedVersion: process.env.SEED_VERSION || 'v1',
    seededAt: new Date().toISOString(),
    chain: {
      wsUrl: endpoint,
      genesisHash: api.genesisHash.toHex(),
      chainId: String(runtimeVersion.specVersion.toNumber()),
      specVersion: runtimeVersion.specVersion.toNumber(),
      metadataVersion: runtimeVersion.transactionVersion.toNumber(),
      block: block.toNumber(),
    },
    teammates: derived,
    contracts: parseContractsEnv(),
  };

  const payload = JSON.stringify(status, null, 2);

  if (args.outPath) {
    const outPath = path.resolve(args.outPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, 'utf-8');
  }

  console.log(payload);
  await api.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
