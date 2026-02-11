# RemitChain Recommended Tech Stack

## Core Protocol
- Blockchain: Substrate (custom pallets, Rust stable)
- Runtime pallets: pallet-assets, pallet-transaction-payment, pallet-multisig, pallet-collective
- Oracles: Chainlink (primary), Band Protocol (secondary), admin emergency prices
- Indexer: SubQuery (primary) plus reconciliation service
- Database: PostgreSQL with Prisma ORM

## Application Layer
- Web app: Next.js 14+ with React and TypeScript
- API: Next.js API routes with rate limiting (Redis)
- Wallets: Polkadot.js extension and WalletConnect v2 (`@walletconnect/ethereum-provider`)
- Notifications: FCM/APNs and SMS provider (e.g., Twilio)

## Infra and Ops
- Containers: Docker
- Orchestration: Kubernetes
- IaC: Terraform or Pulumi
- CI/CD: GitHub Actions
- Monitoring: Prometheus and Grafana
- Logs: Loki or ELK

## Testing and QA
- Rust: cargo test + property testing (proptest)
- E2E: Playwright
- Load: k6 or Locust
- Security: Trivy, SAST, secret scanning
