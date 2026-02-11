# RemitChain

RemitChain is a full-stack remittance prototype with a gasless relayer, SubQuery indexer, and a local Substrate chain scaffold.

## What's Included
- Next.js 14 app (App Router)
- Relayer service (Fastify + Redis queue)
- SubQuery indexer scaffold
- Prisma data layer (Postgres)
- Substrate chain scaffold (`chain/`)

## Repo Structure
- `src/` - Next.js app, API routes, UI
- `services/relayer/` - Relayer service
- `subquery/` - SubQuery project
- `prisma/` - Prisma schema + migrations
- `chain/` - Substrate node + runtime + pallets
- `scripts/` - Dev scripts

## Quick Start (Local)

1. Create env files from examples:
```powershell
copy .env.example .env.local
copy services\relayer\.env.example services\relayer\.env
copy subquery\.env.example subquery\.env
```

2. Start Docker services:
```powershell
docker compose --project-name remitchain --env-file .env.local up -d redis postgres
```

3. Run the chain (in a separate terminal):
```powershell
cargo run -p minimal-template-node --manifest-path chain\Cargo.toml -- --dev --tmp
```

4. Export chain metadata + genesis hash:
```powershell
npm run chain:metadata:apply
```

5. Start dev services:
```powershell
scripts\start-dev.cmd
```

## Notes
- Local chain WS endpoint: `ws://127.0.0.1:9944`
- SubQuery uses the chain genesis hash. The metadata export script updates it.
- Do not commit `.env.local` or other secret-bearing env files.

## Useful Scripts
- `npm run dev` - Run Next.js app
- `npm run chain:metadata:apply` - Export metadata + update envs
- `scripts\start-dev.cmd` - Start all services
- `scripts\clean-dev.cmd` - Clean workspace and re-install

## Docs
See `docs/truth.md` for the source-of-truth specification and `docs/plan.md` for the roadmap.
