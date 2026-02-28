# Teammate Setup Guide

This guide is for teammates who want to work on RemitChain while using the shared Huawei hub backend over Tailscale.

## Environment Model
- Hub laptop (server) runs Docker services: chain, relayer, Redis, Postgres, SubQuery.
- Teammate machine runs app/dev tools only.
- Teammates connect to hub endpoints through Tailscale.

Current hub Tailscale IP:
- `100.97.178.5`

## Identity Rules (Important)
- Each teammate must use a unique `DEV_IDENTITY` from `config/dev-identities.json`.
- Do not share identities (`alice` and `bob` should not be used by two people at once).
- Identity mapping prevents nonce/account collisions.

## Option A: Windows Local Setup (Recommended)

### 1) Prerequisites
- Git
- Node.js + npm
- Tailscale connected to the same tailnet as hub

### 2) Clone and install
```powershell
git clone https://github.com/Savicxz/RemitChain.git
cd RemitChain
npm install
```

### 3) Create local env for remote mode
```powershell
Copy-Item .env.codespaces.example .env.local
```

Edit `.env.local` and set:
- `CHAIN_MODE=remote`
- `REMOTE_DEV_STRICT=true`
- `DEV_IDENTITY=<alice-or-bob>`
- `REMOTE_STATUS_URL=http://100.97.178.5:8787/dev/status`
- `RELAYER_URL=http://100.97.178.5:8787`
- `SUBQUERY_GRAPHQL_URL=http://100.97.178.5:3001`

### 4) Verify hub connectivity
```powershell
curl.exe --max-time 10 http://100.97.178.5:8787/dev/status
```

Expected:
- JSON response
- `health.chainReady` is `true`
- `health.subqueryReady` is `true`

### 5) Start app in remote mode
```powershell
npm run dev:remote
```

Open local app URL shown by Next.js (usually `http://localhost:3000`).

## Option B: Codespaces Setup (For weaker laptops)

### 1) Create Codespace from repo
- Use default `.devcontainer` setup.
- Add Codespaces secret: `TAILSCALE_AUTH_KEY`.

### 2) Configure runtime env
```bash
cp .env.codespaces.example .env.local
```

Edit `.env.local`:
- `DEV_IDENTITY=<alice-or-bob>`
- `REMOTE_STATUS_URL=http://100.97.178.5:8787/dev/status`
- `RELAYER_URL=http://100.97.178.5:8787`
- `SUBQUERY_GRAPHQL_URL=http://100.97.178.5:3001`

### 3) Linux note for `.npmrc`
If `.npmrc` contains `script-shell=cmd.exe`, remove that line in Codespaces:
```bash
sed -i '/^script-shell=cmd\.exe$/d' .npmrc
```

### 4) Verify and run
```bash
curl -m 10 http://100.97.178.5:8787/dev/status
npm run dev:remote
```

## When SSH Is Needed
Teammates do not need SSH for normal app dev.

Use SSH to hub only for ops tasks:
- pull latest hub code
- restart services
- run reset pipeline
- inspect Docker logs

SSH example:
```bash
ssh jasper@100.97.178.5
```

## Hub Admin Quick Commands (Reference)
Run these on hub only:

```bash
cd ~/RemitChain
docker compose -f docker-compose.vm.yml -p remitchain-vm --env-file .env.local ps
curl -m 10 http://127.0.0.1:8787/dev/status
bash ops/reset-dev-chain.sh
```

## Common Issues

### PowerShell `curl -m` fails
Use `curl.exe` on Windows:
```powershell
curl.exe --max-time 10 http://100.97.178.5:8787/dev/status
```

### `connection reset by peer` from hub relayer
- Hub relayer usually has wrong container env values.
- Hub `.env.local` must use container hostnames:
  - `CHAIN_WS_URL=ws://chain:9944`
  - `REDIS_URL=redis://redis:6379`
  - `SUBQUERY_GRAPHQL_URL=http://subquery-query:3001`

### `DEV_IDENTITY` rejected
- Make sure identity exists in `config/dev-identities.json`.
- Ensure no teammate is using the same identity simultaneously.

## Ready Checklist
- Tailscale connected.
- `/dev/status` reachable from teammate machine.
- `DEV_IDENTITY` unique and valid.
- `npm run dev:remote` starts successfully.
- App can fetch nonce and submit through relayer.
