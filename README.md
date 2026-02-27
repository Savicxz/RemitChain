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

## Project Philosophy
RemitChain aims to democratize access to financial services by providing a transparent, low-fee remittance solution powered by blockchain technology. We believe in open-source collaboration to build a robust and inclusive financial infrastructure.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Framer Motion
- **Backend**: Fastify, Redis (Upstash)
- **Blockchain**: Substrate, Polkadot API
- **Database**: PostgreSQL, Prisma
- **Indexer**: SubQuery

## Quick Start (Local)

1. **Environment Setup**:
   ```powershell
   copy .env.example .env.local
   copy services\relayer\.env.example services\relayer\.env
   copy subquery\.env.example subquery\.env
   ```

2. **Start Docker Services**:
   ```powershell
   docker compose --project-name remitchain --env-file .env.local up -d redis postgres
   ```

3. **Run the Chain** (in a separate terminal):
   ```powershell
   cargo run -p minimal-template-node --manifest-path chain\Cargo.toml -- --dev --tmp
   ```

4. **Export Chain Metadata**:
   ```powershell
   npm run chain:metadata:apply
   ```

5. **Start Dev Services**:
   ```powershell
   scripts\start-dev.cmd
   ```

## Remote Team Dev (Codespaces + Shared VM)

1. Copy `.env.codespaces.example` to `.env.local` and set `DEV_IDENTITY` + `REMOTE_STATUS_URL`.
2. Start remote mode from Codespaces:
   ```bash
   npm run dev:remote
   ```
3. `scripts/start-dev.sh` fetches `/dev/status`, writes `.env.runtime`, and enforces mapped dev identity.
4. Chain/session drift is detected in-app; reconnect wallet when prompted.

Reset controls (VM):
- `GET /dev/status` on relayer for handshake/runtime status
- `POST /dev/reset` with `X-Reset-Token` to trigger `ops/reset-dev-chain.sh`
- `GET /dev/reset/:id` to follow reset progress

## Contributing
We welcome contributions from the community! Whether it's reporting bugs, suggesting features, or submitting pull requests, your help is appreciated.

- Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started.
- Review our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment.
- Check out the [Issue Templates](.github/ISSUE_TEMPLATE/) for reporting bugs or requesting features.

## Notes
- Local chain WS endpoint: `ws://127.0.0.1:9944`
- SubQuery uses the chain genesis hash. The metadata export script updates it.
- Do not commit `.env.local` or other secret-bearing env files.

## Useful Scripts
- `npm run dev` - Run Next.js app
- `npm run dev:remote` - Start in remote mode using `/dev/status` handshake
- `npm run chain:metadata:apply` - Export metadata + update envs
- `npm run seed:remote` - Build deterministic seed payload for remote chain session
- `npm run reset:remote` - Run VM reset pipeline (chain restart + seed + indexer schema reset)
- `scripts\start-dev.cmd` - Start all services
- `scripts\clean-dev.cmd` - Clean workspace and re-install

## Docs
See `docs/truth.md` for the source-of-truth specification and `docs/plan.md` for the roadmap.
See `docs/remote-dev.md` for the shared VM + Codespaces runbook.
