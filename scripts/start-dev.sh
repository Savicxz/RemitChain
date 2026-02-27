#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

CHAIN_MODE="${CHAIN_MODE:-remote}"
REMOTE_DEV_STRICT="${REMOTE_DEV_STRICT:-true}"
DEV_IDENTITIES_PATH="${DEV_IDENTITIES_PATH:-$ROOT_DIR/config/dev-identities.json}"
DEV_IDENTITY="${DEV_IDENTITY:-${GITHUB_USER:-${CODESPACE_NAME:-${USER:-}}}}"

if [[ "$CHAIN_MODE" != "remote" ]]; then
  echo "CHAIN_MODE=$CHAIN_MODE is not remote. This script is intended for remote startup."
  exit 1
fi

if [[ -z "${REMOTE_STATUS_URL:-}" ]]; then
  if [[ -n "${RELAYER_URL:-}" ]]; then
    REMOTE_STATUS_URL="${RELAYER_URL%/}/dev/status"
  else
    echo "REMOTE_STATUS_URL or RELAYER_URL is required."
    exit 1
  fi
fi

STATUS_FILE="$(mktemp)"
if ! curl --fail --silent --show-error --retry 5 --retry-delay 2 "$REMOTE_STATUS_URL" -o "$STATUS_FILE"; then
  echo "Failed to fetch remote status from $REMOTE_STATUS_URL"
  rm -f "$STATUS_FILE"
  exit 1
fi

RUNTIME_FILE="$ROOT_DIR/.env.runtime"
node - "$STATUS_FILE" "$DEV_IDENTITIES_PATH" "$DEV_IDENTITY" "$REMOTE_DEV_STRICT" "$REMOTE_STATUS_URL" > "$RUNTIME_FILE" <<'NODE'
const fs = require('fs');
const path = require('path');

const [statusPath, identityPath, identityArg, strictArg, statusUrl] = process.argv.slice(2);
const strictMode = strictArg === 'true';
const identityId = (identityArg || '').trim();

const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
const identityConfig = fs.existsSync(identityPath)
  ? JSON.parse(fs.readFileSync(identityPath, 'utf-8'))
  : { teammates: [] };
const teammates = Array.isArray(identityConfig)
  ? identityConfig
  : Array.isArray(identityConfig.teammates)
  ? identityConfig.teammates
  : [];

const required = [
  ['chain.wsUrl', status.chain && status.chain.wsUrl],
  ['chain.genesisHash', status.chain && status.chain.genesisHash],
  ['chain.chainId', status.chain && status.chain.chainId],
  ['subquery.graphqlUrl', status.subquery && status.subquery.graphqlUrl],
];

const missing = required.filter(([, value]) => !value).map(([name]) => name);
if (strictMode && missing.length > 0) {
  throw new Error(`Remote status is missing required fields: ${missing.join(', ')}`);
}

if (strictMode) {
  const generatedAt = status.generatedAt ? Date.parse(String(status.generatedAt)) : NaN;
  if (Number.isNaN(generatedAt)) {
    throw new Error('Remote status missing generatedAt timestamp.');
  }
  const ageMs = Date.now() - generatedAt;
  if (ageMs > 36 * 60 * 60 * 1000) {
    throw new Error('Remote status is stale (older than 36 hours).');
  }
}

let teammate = null;
if (identityId) {
  teammate = teammates.find((entry) => String(entry.id || '').toLowerCase() === identityId.toLowerCase()) || null;
}

if (strictMode && !teammate) {
  throw new Error(`No teammate mapping found for identity '${identityId}'.`);
}

const env = {
  CHAIN_MODE: 'remote',
  REMOTE_STATUS_URL: statusUrl,
  REMOTE_DEV_STRICT: strictMode ? 'true' : 'false',
  CHAIN_WS_URL: status.chain && status.chain.wsUrl ? String(status.chain.wsUrl) : '',
  SUBQUERY_CHAIN_ID:
    status.chain && status.chain.genesisHash ? String(status.chain.genesisHash) : '',
  NEXT_PUBLIC_CHAIN_GENESIS_HASH:
    status.chain && status.chain.genesisHash ? String(status.chain.genesisHash) : '',
  NEXT_PUBLIC_CHAIN_ID:
    status.chain && status.chain.chainId ? String(status.chain.chainId) : '',
  SUBQUERY_GRAPHQL_URL:
    status.subquery && status.subquery.graphqlUrl ? String(status.subquery.graphqlUrl) : '',
  DEV_IDENTITY: teammate ? String(teammate.id) : identityId,
  DEV_INDEX: teammate && teammate.devIndex !== undefined ? String(teammate.devIndex) : '',
  DEV_ACCOUNT_ADDRESS: teammate && teammate.address ? String(teammate.address) : '',
  NEXT_PUBLIC_DEV_IDENTITY: teammate ? String(teammate.id) : identityId,
  NEXT_PUBLIC_DEV_ACCOUNT_ADDRESS: teammate && teammate.address ? String(teammate.address) : '',
};

const contracts = status.contracts && typeof status.contracts === 'object' ? status.contracts : {};
for (const [key, value] of Object.entries(contracts)) {
  if (!value) continue;
  const formatted = `NEXT_PUBLIC_CONTRACT_${String(key)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase()}`;
  env[formatted] = String(value);
}

for (const [key, value] of Object.entries(env)) {
  if (value === '') continue;
  process.stdout.write(`${key}=${String(value)}\n`);
}
NODE

rm -f "$STATUS_FILE"

echo "Wrote runtime env to .env.runtime"

set -a
# shellcheck disable=SC1091
source "$RUNTIME_FILE"
set +a

echo "Starting web in remote mode (CHAIN_MODE=$CHAIN_MODE, DEV_IDENTITY=${DEV_IDENTITY:-unset})"
exec npm run dev
