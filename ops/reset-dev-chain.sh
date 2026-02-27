#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${VM_COMPOSE_FILE:-docker-compose.vm.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-remitchain-vm}"
CHAIN_WS_URL="${CHAIN_WS_URL:-ws://127.0.0.1:9944}"
SUBQUERY_SCHEMA="${SUBQUERY_NAME:-remitchain-indexer}"
STATUS_FILE="${DEV_STATUS_FILE:-$ROOT_DIR/ops/dev-status.json}"
SEED_FILE="${SEED_OUTPUT_FILE:-$ROOT_DIR/ops/seed-output.json}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-remitchain}"

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" --project-name "$COMPOSE_PROJECT" "$@"
  else
    docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"
  fi
}

wait_for_chain() {
  local endpoint="$1"
  local retries=60
  for ((i=1; i<=retries; i++)); do
    if CHAIN_WS_URL="$endpoint" node - <<'NODE' >/dev/null 2>&1
const { ApiPromise, WsProvider } = require('@polkadot/api');
(async () => {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.CHAIN_WS_URL) });
  const block = await api.query.system.number();
  await api.disconnect();
  if (Number(block.toString()) >= 1) {
    process.exit(0);
  }
  process.exit(1);
})().catch(() => process.exit(1));
NODE
    then
      return 0
    fi
    sleep 2
  done

  echo "Timed out waiting for chain endpoint $endpoint"
  return 1
}

echo "[reset] Starting core services..."
compose_cmd up -d chain redis postgres

echo "[reset] Waiting for chain..."
wait_for_chain "$CHAIN_WS_URL"

echo "[reset] Exporting metadata..."
CHAIN_WS_URL="$CHAIN_WS_URL" npm run chain:metadata:apply >/dev/null

echo "[reset] Running deterministic seed script..."
CHAIN_WS_URL="$CHAIN_WS_URL" node scripts/seed-remote-dev.cjs --out "$SEED_FILE" >/dev/null

echo "[reset] Ensuring btree_gist extension exists..."
compose_cmd exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "CREATE EXTENSION IF NOT EXISTS btree_gist;" >/dev/null

echo "[reset] Resetting SubQuery schema '$SUBQUERY_SCHEMA'..."
compose_cmd exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA IF EXISTS \"$SUBQUERY_SCHEMA\" CASCADE; CREATE SCHEMA \"$SUBQUERY_SCHEMA\";" >/dev/null

echo "[reset] Restarting indexer services..."
compose_cmd up -d subquery-node subquery-query relayer

mkdir -p "$(dirname "$STATUS_FILE")"

node - "$SEED_FILE" "$STATUS_FILE" <<'NODE'
const fs = require('fs');
const path = require('path');

const [seedPath, statusPath] = process.argv.slice(2);
const now = new Date().toISOString();
const seed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf-8')) : {};

const status = {
  generatedAt: now,
  metadataVersion: seed?.chain?.metadataVersion ?? null,
  seed: {
    seedVersion: seed?.seedVersion ?? 'v1',
    seededAt: seed?.seededAt ?? now,
    teammates: seed?.teammates ?? [],
  },
  contracts: seed?.contracts ?? {},
};

fs.mkdirSync(path.dirname(statusPath), { recursive: true });
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
NODE

echo "[reset] Completed. Status file: $STATUS_FILE"
