/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { ApiPromise, WsProvider } = require('@polkadot/api');

const endpoint = process.env.CHAIN_WS_URL || 'ws://127.0.0.1:9944';
const rootDir = path.resolve(__dirname, '..');
const chainDir = path.join(rootDir, 'chain');

function writeIfChanged(filePath, contents) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    if (existing === contents) {
      return false;
    }
  }
  fs.writeFileSync(filePath, contents, 'utf-8');
  return true;
}

function updateEnvValue(envPath, key, value) {
  if (!fs.existsSync(envPath)) {
    return false;
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split(/?
/);
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    updated.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, updated.join('
'), 'utf-8');
  return true;
}

async function main() {
  const provider = new WsProvider(endpoint);
  const api = await ApiPromise.create({ provider });

  const genesisHash = api.genesisHash.toHex();
  const runtimeVersion = api.runtimeVersion;
  const metadataHex = api.runtimeMetadata.toHex();
  const metadataJson = JSON.stringify(api.runtimeMetadata.toJSON(), null, 2);

  const info = {
    endpoint,
    genesisHash,
    specName: runtimeVersion.specName.toString(),
    specVersion: runtimeVersion.specVersion.toNumber(),
    transactionVersion: runtimeVersion.transactionVersion.toNumber(),
  };

  if (!fs.existsSync(chainDir)) {
    fs.mkdirSync(chainDir, { recursive: true });
  }

  writeIfChanged(path.join(chainDir, 'metadata.scale'), metadataHex);
  writeIfChanged(path.join(chainDir, 'metadata.json'), metadataJson);
  writeIfChanged(path.join(chainDir, 'chain-info.json'), JSON.stringify(info, null, 2));

  const args = new Set(process.argv.slice(2));
  if (args.has('--apply-env')) {
    updateEnvValue(path.join(rootDir, 'subquery/.env'), 'SUBQUERY_CHAIN_ID', genesisHash);
    updateEnvValue(path.join(rootDir, '.env.local'), 'CHAIN_WS_URL', endpoint);
  }

  console.log('Chain metadata exported.');
  console.log(`Genesis hash: ${genesisHash}`);
  console.log(`Spec: ${info.specName} v${info.specVersion}`);

  await api.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
