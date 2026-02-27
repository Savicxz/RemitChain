# Remote Dev Runbook

## Prerequisites
- Shared VM reachable on private VPN.
- `config/dev-identities.json` contains your `id`, `devIndex`, and expected address.
- Codespaces secret: `TAILSCALE_AUTH_KEY`.

## Codespaces startup
1. Copy `.env.codespaces.example` to `.env.local`.
2. Set `DEV_IDENTITY` and `REMOTE_STATUS_URL`.
3. Run:
   ```bash
   npm run dev:remote
   ```

`start-dev.sh` fetches `/dev/status`, validates chain session, and writes `.env.runtime`.

## Reset controls
- Trigger reset:
  ```bash
  curl -X POST "$RELAYER_URL/dev/reset" -H "X-Reset-Token: $RELAYER_RESET_TOKEN"
  ```
- Query reset job:
  ```bash
  curl "$RELAYER_URL/dev/reset/<job-id>"
  ```

## VM reset pipeline
`ops/reset-dev-chain.sh` performs:
1. chain restart
2. metadata export
3. deterministic seed
4. SubQuery schema reset
5. SubQuery + relayer restart
6. status file refresh (`ops/dev-status.json`)

## Nonce-collision protection
- Frontend enforces `NEXT_PUBLIC_DEV_ACCOUNT_ADDRESS`.
- Relayer enforces `x-dev-identity` mapping when `RELAYER_ENFORCE_DEV_IDENTITY=true`.
