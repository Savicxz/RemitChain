# RemitChain Build Status Inventory

> Cross-referenced against [truth.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/truth.md) and the actual repo contents
> Updated: 2026-02-11

---

## ✅ Built

### Frontend — Next.js App
| Component | File(s) | Notes |
|-----------|---------|-------|
| Root layout | [layout.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/layout.tsx) | HTML skeleton, font, global providers |
| Login page with wallet connect | [login/page.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/(auth)/login/page.tsx) | Polkadot.js extension + WalletConnect v2 |
| Dashboard layout with auth gate | [layout.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/(dashboard)/layout.tsx), [auth-gate.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/auth-gate.tsx) | Redirects unauthenticated users |
| Dashboard overview (balance, corridors, tx history) | [page.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/(dashboard)/page.tsx) | Shows all 5 corridors, recent settlements |
| Corridors listing page | [corridors/page.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/(dashboard)/corridors/page.tsx) | Rates and fees per corridor |
| Compliance / KYC status page | [compliance/page.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/(dashboard)/compliance/page.tsx) | Shows tier level and daily limits |
| Send flow (3-step: corridor → amount → confirm) | [send-flow/](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/send-flow/) | `index.tsx`, `step-corridor.tsx`, `step-amount.tsx`, `step-confirm.tsx` |
| WalletConnect v2 component | [wallet-connect.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/wallet-connect.tsx) | Upgraded from v1 |
| Top navigation with KYC badge | [top-nav.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/top-nav.tsx) | Nav links, logout, KYC indicator |
| UI components (Button, Badge, Logo, HealthBadge) | [ui/](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/ui/) | `button.tsx`, `badge.tsx`, `logo.tsx`, `health-badge.tsx` |
| Global wallet state (Zustand) | [use-wallet-store.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/store/use-wallet-store.ts) | Auth, multi-asset balances, KYC level, tx history, send/status |
| Tailwind config with dark theme | [tailwind.config.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/tailwind.config.ts), [globals.css](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/globals.css) | Custom colour palette, fonts |
| Static data & types | [data.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/data.ts) | Corridors, Assets (USDC/USDT/DAI/jMYR/jPHP), Transactions, flag helper |

### Wallet & Signing
| Component | File(s) | Notes |
|-----------|---------|-------|
| Polkadot.js wallet connection | [polkadot.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/polkadot.ts) | `web3Enable` + `web3Accounts` |
| Meta-transaction signing (nonce, deadline, chainId) | [signing.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/signing.ts) | Builds delimited payload, signs via extension |
| Local + server nonce management | [signing.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/signing.ts) | localStorage fallback + `/api/nonce` |

### API Routes
| Endpoint | File | Notes |
|----------|------|-------|
| `POST /api/remittance` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/remittance/route.ts) | Dual mode: relayer proxy or placeholder |
| `GET /api/remittance/status/[id]` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/remittance/status/%5Bid%5D/route.ts) | Proxies to relayer service |
| `GET /api/chain/head` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/chain/head/route.ts) | Returns current block number |
| `GET /api/nonce` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/nonce/route.ts) | Fetches nonce from relayer |
| `POST /api/notify` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/notify/route.ts) | SMS (Twilio) + push (Firebase) |
| `GET /api/health` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/health/route.ts) | Checks chain, relayer, and Redis subsystem health |
| `GET /api/compliance/flagged-accounts` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/compliance/flagged-accounts/route.ts) | ⚠️ Stub — returns empty data |
| `POST /api/compliance/sanctions-check` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/compliance/sanctions-check/route.ts) | ⚠️ Stub — always returns CLEAR |
| `GET /api/compliance/sar-reports` | [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/compliance/sar-reports/route.ts) | ⚠️ Stub — returns empty data |
| Rate limiting middleware | [middleware.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/middleware.ts) | Upstash Redis sliding window |

### Shared Libraries (`src/lib/`)
| Module | File | Notes |
|--------|------|-------|
| Chain connection (Polkadot API) | [chain.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/chain.ts) | `getApi()`, `submitRemittancePlaceholder()` — placeholder only |
| Redis client | [redis.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/redis.ts) | Upstash `Redis.fromEnv()` with graceful fallback |
| Prisma client | [prisma.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/prisma.ts) | `getPrisma()` with PrismaPg adapter, hot-reload safe |
| API guards (auth + rate limit) | [api-guards.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/api-guards.ts) | `requireInternalApiKey()`, `guardInternalRequest()` |
| Compliance schemas / types | [compliance-schemas.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/compliance-schemas.ts) | Types for flagged accounts, SAR reports, sanctions checks |
| Rate limit helper | [ratelimit.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/ratelimit.ts) | `checkRateLimit()` |
| Notifications helper | [notifications.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/notifications.ts) | SMS + push notification logic |
| Utilities | [utils.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/utils.ts) | Misc helpers |

### Relayer Service
| Component | File | Notes |
|-----------|------|-------|
| Fastify server with job queue | [index.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/src/index.ts) | 454 lines, fully implemented |
| Signature verification (sr25519) | Same file | `signatureVerify` from `@polkadot/util-crypto` |
| Nonce + deadline + chainId replay protection | Same file | Lua atomic compare-and-set for Redis |
| Idempotency key support | Same file | Redis-backed with TTL |
| Job queue (Redis or in-memory fallback) | Same file | Enqueue → dequeue → retry up to 3× |
| Chain submission via `ApiPromise` | Same file | Builds extrinsic, signs with relayer key |
| Health endpoint | Same file | `GET /health` |

### SubQuery Indexer
| Component | File | Notes |
|-----------|------|-------|
| Project config | [project.yaml](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/subquery/project.yaml), [project.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/subquery/project.ts) | 4 event handlers configured |
| GraphQL schema (Remittance + Dispute) | [schema.graphql](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/subquery/schema.graphql) | 2 entities |
| Event mapping handlers | [remittance.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/subquery/src/mappings/remittance.ts) | `handleRemittanceSent`, `handleCashOutRequested`, `handleCashOutCompleted`, `handleDisputeOpened` |

### Database (Prisma + PostgreSQL)
| Component | File | Notes |
|-----------|------|-------|
| Prisma schema (4 models) | [schema.prisma](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/prisma/schema.prisma) | `User`, `Remittance`, `ComplianceFlag`, `TravelRuleRecord` |
| Initial migration | [migrations/](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/prisma/migrations/) | `20260211013739_init` |
| Prisma config | [prisma.config.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/prisma.config.ts) | Adapter config |
| PostgreSQL via Docker Compose | [docker-compose.yml](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docker-compose.yml) | Postgres 17 + Redis 7 |

### Infrastructure / Config
| Component | File | Notes |
|-----------|------|-------|
| Docker Compose (Redis + PostgreSQL) | [docker-compose.yml](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docker-compose.yml) | Dev services, persistent volumes |
| Dev startup script (PowerShell) | [start-dev.ps1](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/scripts/start-dev.ps1) | Starts Redis, chain, relayer, web, SubQuery |
| Dev startup (CMD) | [start-dev.cmd](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/scripts/start-dev.cmd) | Alternative starter |
| Cleanup script | [clean-dev.cmd](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/scripts/clean-dev.cmd) | Cleans dev environment |
| Relayer JSON check | [check-relayer-json.ps1](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/scripts/check-relayer-json.ps1) | Validates relayer config |
| Environment config template | [.env.example](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/.env.example) | All required env vars |
| Environment local | [.env.local](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/.env.local) | Local overrides |
| Relayer env config | [.env](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/.env), [.env.example](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/.env.example) | Dev defaults |
| Next.js config | [next.config.js](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/next.config.js) | Build config |
| PostCSS config | [postcss.config.js](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/postcss.config.js) | Tailwind pipeline |
| TypeScript config | [tsconfig.json](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/tsconfig.json) | Project-wide TS settings |

### Documentation
| Doc | File | Notes |
|-----|------|-------|
| Source of truth spec | [truth.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/truth.md) | Merged spec + architecture |
| Architecture review | [architecture-review.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/architecture-review.md) | Gap analysis of spec |
| Delivery plan | [plan.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/plan.md) | 48-week phased roadmap |
| Tech stack reference | [tech-stack.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/tech-stack.md) | Stack choices |
| Codebase audit | [codebase-audit.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/codebase-audit.md) | 29 issues found |
| Frontend design comp | [Frontend_Design.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/Frontend_Design.md) | UI design reference |
| Frontend design JSX | [RemitChainApp.jsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/RemitChainApp.jsx) | Design prototype |
| Build status (this file) | [build-status.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/build-status.md) | Inventory |

---

## ❌ Not Built Yet

### Substrate Blockchain (the entire on-chain layer)
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| `pallet-remitchain` — core remittance flow, escrow, state machine | truth.md §1 | P1 |
| `pallet-kyc` — Merkle root / SBT verification, tier limits | truth.md §4 | P2 |
| `pallet-agents` — agent onboarding, staking, reputation, matching | truth.md §5 | P2 |
| `pallet-disputes` — dispute lifecycle, bonds, arbitration | truth.md §7 | P2 |
| `pallet-compliance` — velocity checks, sanctions, on-chain flags | truth.md §8 | P1 |
| `pallet-oracle` — price feeds, staleness, circuit breakers | truth.md §2 | P1 |
| `pallet-fees` — fee calc, discounts, distribution | truth.md §12 | P3 |
| Substrate node binary / runtime config | truth.md §9 | P1 |
| Chain genesis config | — | P1 |
| `sendRemittanceGasless` extrinsic | truth.md §1 | P1 |

### Backend Services
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| Reconciliation service (chain vs DB integrity) | truth.md §3 | P1 |
| Compliance service (real sanctions screening, SAR generation) | truth.md §8 | P1 |
| Compliance API real implementation (currently stubs) | truth.md §8 | P1 |
| Admin dashboard backend | truth.md §9 | P2 |
| Partner integration APIs (webhooks, white-label) | spec.md §15 | P3 |
| Real chain submission (replace `submitRemittancePlaceholder`) | spec.md §1 | P1 |

### Frontend Features
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| Multi-asset selector in send flow (USDT, DAI, jMYR, jPHP) | truth.md §2 | P1 |
| Real-time transaction status tracker with ETA | spec.md §11 | P2 |
| Recipient wallet address input field | — | P1 |
| Dispute filing UI | truth.md §7 | P2 |
| Admin dashboard (compliance, disputes, agents) | truth.md §9 | P2 |
| Localization (10+ languages) | spec.md §11 | P2 |
| Social login / wallet abstraction | spec.md §11 | P2 |
| Mobile PWA with biometric auth | spec.md §11 | P2 |
| WCAG 2.1 AA accessibility | spec.md §11 | P2 |
| Real KYC flow (Sumsub/Onfido/Jumio integration) | truth.md §4 | P2 |
| Add Funds functionality | — | P2 |

### Oracle & Price Feeds
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| Chainlink price feed integration | truth.md §2 | P1 |
| Band Protocol fallback | truth.md §2 | P1 |
| Admin emergency manual prices | truth.md §2 | P1 |
| Circuit breaker UI (depeg warnings) | truth.md §2 | P1 |
| FX rate locking with expiry timestamps | truth.md §2 | P1 |

### Governance
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| Multi-sig setup (3-of-5 admin council) | truth.md §6 | P1 |
| Role-based access control (KYC ops, oracle ops, relayer, auditor) | truth.md §6 | P1 |
| Time-locked governance changes (7-day delay) | truth.md §6 | P1 |
| Emergency pause/unpause | truth.md §6 | P1 |

### Infrastructure & DevOps
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| Dockerfiles (node, web, indexer, relayer) | truth.md §9 | P2 |
| Kubernetes manifests + Helm charts | truth.md §9 | P2 |
| CI/CD pipeline (GitHub Actions) | truth.md §9 | P2 |
| Prometheus + Grafana dashboards | truth.md §9 | P2 |
| Centralized logging (Loki / ELK) | truth.md §9 | P2 |
| Disaster recovery runbooks | truth.md §9 | P2 |
| `.gitignore` | — | P1 |

### Testing
| Component | Spec Reference | Priority |
|-----------|---------------|----------|
| Pallet unit tests (Rust) | truth.md §10 | P2 |
| Integration tests (full remittance flow) | truth.md §10 | P2 |
| E2E tests (Playwright) | truth.md §10 | P2 |
| Load tests (k6 / Locust) | truth.md §10 | P2 |
| Chaos tests (node/indexer/oracle failure) | truth.md §10 | P2 |
| Security scanning in CI | truth.md §10 | P2 |

---

## 📊 Summary

| Category | Built | Not Built |
|----------|-------|-----------|
| Frontend pages/components | 13 | 11 |
| Wallet & signing | 3 | 0 |
| API routes (incl. 3 stubs) | 10 | 0 |
| Shared libraries (`src/lib/`) | 8 | 0 |
| Relayer service | 7 | 0 |
| SubQuery indexer | 3 | 0 |
| Database / Prisma | **4** | 0 |
| Substrate pallets | 0 | **10** |
| Backend services | 0 | **6** |
| Oracle / price feeds | 0 | **5** |
| Governance | 0 | **4** |
| Infrastructure / DevOps | 11 | 7 |
| Testing | 0 | **6** |
| Documentation | 8 | 0 |
| **Total** | **67** | **49** |

> **~58% built, ~42% remaining.** The frontend, relayer, indexer, database, and shared libraries are mature. The compliance APIs exist but are stubs. The entire on-chain layer (10 items: pallets, node, genesis) remains the largest gap, followed by oracle/price feeds (5), backend services (6), governance (4), and testing (6). No `.gitignore` exists yet.
