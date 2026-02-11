# RemitChain Source of Truth

This document supersedes `docs/architecture-review.md`.
If there is any conflict, this document is the single source of truth for implementation.

## Purpose
- Provide a build-ready specification for the RemitChain production platform.
- Clarify design decisions and resolve open questions from prior docs.
- Define deliverables and output format for agents.

## High-Level Goals
- Gasless remittances with strong anti-abuse controls.
- Multi-stablecoin support with oracle safety and circuit breakers.
- Privacy-preserving KYC with no PII on-chain.
- Reliable indexing and reconciliation with reorg safety.
- Liquidity pools, escrow, slashing, and dispute resolution.
- Multi-sig governance and role-based access control.
- Regulatory compliance (AML/CTF, sanctions, travel rule).
- Production-grade deployment, monitoring, and incident response.
- Comprehensive testing and security hardening.

## System Architecture

### On-Chain Pallets
Decompose into focused pallets to avoid a monolith:

- `pallet-remitchain`: core remittance flow and escrow state.
- `pallet-kyc`: KYC verification (Merkle root or SBT).
- `pallet-agents`: agent onboarding, staking, reputation, matching.
- `pallet-disputes`: dispute lifecycle and arbitration.
- `pallet-compliance`: velocity checks and on-chain compliance flags.
- `pallet-oracle`: price feeds, staleness checks, circuit breakers.
- `pallet-fees`: fee calculation, discounts, distribution.

### Off-Chain Services
- Relayer service for gasless transactions.
- Web app and API (Next.js).
- SubQuery indexer and GraphQL API.
- Reconciliation service (chain vs DB).
- Compliance service (sanctions checks, SAR generation).
- Notification service (email/SMS/push).
- Admin dashboard.

## Technical Requirements

### 1) Gasless Transactions (Priority 1)
Goal: Users do not need native REMIT for fees.

Relayer requirements:
- Submit transactions on behalf of users.
- Cover gas costs up front, recover from remittance or service fee.
- Nonce management, replay protection, and expiry.
- Rate limits and anti-abuse checks.

Meta-transaction structure (required fields):
```rust
pub struct MetaTransaction<T: Config> {
    pub sender: T::AccountId,
    pub recipient: T::AccountId,
    pub asset_id: T::AssetId,
    pub amount: T::Balance,
    pub corridor: CorridorId,
    pub nonce: u64,
    pub deadline: T::BlockNumber,
    pub chain_id: u64,
}
```

Replay protection:
- Store per-sender relayer nonces.
- Reject any nonce that is not strictly incremental.
- Reject expired `deadline`.

Relayer nonces storage:
```rust
#[pallet::storage]
pub type RelayerNonces<T: Config> = StorageMap<
    _, Blake2_128Concat, T::AccountId, u64, ValueQuery
>;
```

Anti-abuse:
- First time user deposit: 5 USD equivalent (stablecoin).
- Max 10 meta-tx per user per hour.
- Simulate transaction off-chain before submission.
- Failed tx costs are covered by user deposit.

API endpoint:
```
POST /api/remittance/send
{
  "from": "0x...",
  "to": "0x...",
  "amount": "100.00",
  "assetId": "USDC",
  "corridor": "MY-PH",
  "signature": "0x...",
  "nonce": 42,
  "deadline": 123456
}
```

### 2) Multi-Asset Stablecoins and Circuit Breakers (Priority 1)
Assets:
- Use `pallet-assets` for ERC-20 style tokens.
- Supported stablecoins: USDC, USDT, DAI, tokenized fiat (jMYR, jPHP).

Oracles:
- Primary: Chainlink.
- Secondary: Band Protocol.
- Emergency: admin multi-sig manual price (time-limited).
- Use median of available feeds.
- Enforce staleness checks.

Depeg thresholds and actions (per asset):
- 0 to 1 percent: normal.
- 1 to 2 percent: warning event, large tx require admin approval.
- 2 to 5 percent: pause new tx, allow in-flight settlement.
- > 5 percent: full halt.

Degraded mode:
- If all oracles are stale, allow only small tx (e.g., < 100 USD)
  using last known price and emit `OracleDegraded`.

FX rates:
- Store corridor rates on-chain with expiry.
- Show "rate locked until" timestamp to users.

### 3) Indexer, Reorg Handling, and Reconciliation (Priority 1)
Indexer:
- SubQuery indexes RemittanceSent, CashOutRequested, CashOutCompleted,
  DisputeOpened, and compliance events.
- GraphQL API for frontend queries.

Reorg handling:
- Use `reorgThreshold: 12`.
- Never mark a transaction as confirmed before 12 blocks.
- Escrow releases only after 12-block confirmation.

Reconciliation service:
- Runs every 6 hours, checks last 1000 blocks.
- Auto-heals gaps and alerts on discrepancies > 10 tx.
- Tracks indexer lag and uptime.

### 4) Privacy-Preserving KYC (Priority 2)
Approach:
- Store only Merkle root or SBT on-chain.
- No PII on-chain.

Hybrid scalability:
- New approvals mint a temporary SBT (valid for 48 hours).
- Batch Merkle root updates every 6 hours.
- After root update, SBT is burned.

Tiers:
- Tier 1: 1,000 USD per day.
- Tier 2: 10,000 USD per day.
- Tier 3: 50,000 USD per day or unlimited by policy.

Off-chain providers:
- Integrate Sumsub, Onfido, or Jumio.
- Store documents off-chain encrypted.

### 5) Liquidity Management and Settlement (Priority 2)
Agent onboarding:
- Agents stake stablecoin (USDC/USDT) as operational bond.
- Minimum bond: 10,000 USD equivalent.
- Agents can set corridor support and daily capacity.

Escrow and timeouts:
- Funds locked in escrow when remittance is sent.
- Agent must confirm cash-out within 24 hours.
- Timeout enforcement uses lazy evaluation or OCW.
- Provide `claim_timeout_refund()` for sender.

Slashing and reputation:
- Failed or delayed cash-outs incur 5 percent slashing.
- Reputation tracked by completion rate, time, disputes.

Matching rules:
- Match by liquidity, reputation, and geography.
- Enforce conflict of interest: agent cannot be sender or recipient.

### 6) Governance and Access Control (Priority 1)
- Multi-sig 3 of 5 for critical actions.
- KYC operators 2 of 3.
- Oracle operators 2 of 3.
- Relayer role single sig with on-chain limits.
- Time-locked governance changes (7 days).

Critical actions:
- Update KYC root, circuit breakers, fee changes.
- Add or remove assets and corridors.
- Agent slashing and whitelist.

### 7) Dispute Resolution (Priority 2)
- Dispute types: did not receive, wrong amount, user refused pickup, invalid recipient.
- Evidence stored off-chain; on-chain IPFS hash only.
- Dispute bond: 5 percent of remittance amount.
- If dispute fails, bond is paid to the other party.
- Escalation timer: auto-resolve in favor of agent if no action in 14 days.

### 8) Compliance and AML/CTF (Priority 1)
On-chain:
- KYC tier limits.
- Daily and monthly volume tracking.
- Sanctioned country list (small set).
- Velocity flags.

Off-chain:
- Wallet address sanctions screening.
- SAR generation.
- Travel rule data (PII).
- Manual review workflow.

Compliance APIs:
- `GET /api/compliance/flagged-accounts`
- `GET /api/compliance/sar-reports`
- `POST /api/compliance/sanctions-check`

### 9) Deployment, Monitoring, and DR (Priority 2)
- Dockerfiles for node, web, indexer, relayer.
- Kubernetes manifests and Helm charts.
- CI/CD with build, tests, SAST, secrets scan, deploy.
- Prometheus + Grafana dashboards.
- Structured JSON logs with 30 day hot retention, 1 year archive.
- Health endpoint `/health` with chain, db, indexer, and oracle status.

Disaster recovery:
- Multi-sig key compromise: time-locked rotation.
- Database corruption: PITR via WAL.
- Oracle failure: degraded mode and admin emergency prices.
- Relayer key compromise: rotate and revoke on-chain.

### 10) Testing and QA (Priority 2)
- Unit tests per pallet with mocks.
- Integration tests for full remittance flow.
- E2E tests (Playwright).
- Load tests (k6 or Locust).
- Chaos testing for node, indexer, and oracle failures.
- Security scanning in CI.

### 11) UX and Product (Priority 2)
- Wallet abstraction with social login and recovery.
- Transaction status tracking and ETA.
- Localization for 10+ languages.
- Mobile-first PWA, biometric auth.
- WCAG 2.1 AA accessibility.

### 12) Tokenomics (Priority 3)
- REMIT used for gas, governance, and fee discounts.
- Agents stake stablecoin for operational bond.
- Fee model: base 1.5 percent, instant +0.5 percent, off-peak -0.3 percent.
- Revenue split: 40 percent LP, 30 percent treasury, 20 percent stakers, 10 percent insurance.
- Max supply 1B REMIT and vesting schedule.

## Data Model (Prisma)
Include a baseline schema for off-chain data:

```prisma
model User {
  id            String   @id @default(uuid())
  walletAddress String   @unique
  email         String?  @unique
  kycTier       Int      @default(0)
  kycProvider   String?
  kycExternalId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  remittances     Remittance[]
  complianceFlags ComplianceFlag[]
}

model Remittance {
  id              String   @id @default(uuid())
  onChainId       String   @unique
  sender          User     @relation(fields: [senderId], references: [id])
  senderId        String
  recipientWallet String
  amount          Decimal
  sourceAsset     String
  destAsset       String
  corridor        String
  status          String
  txHash          String?
  blockNumber     BigInt?
  agentWallet     String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
}

model ComplianceFlag {
  id        String   @id @default(uuid())
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  reason    String
  severity  String
  resolved  Boolean  @default(false)
  notes     String?
  createdAt DateTime @default(now())
}

model TravelRuleRecord {
  id              String   @id @default(uuid())
  remittanceId    String
  originatorName  String
  originatorId    String
  beneficiaryName String
  beneficiaryId   String
  sharedWith      String[]
  createdAt       DateTime @default(now())
}
```

## Rate Limiting Architecture
- Edge (Cloudflare or Nginx): 60 req/min per IP, token bucket.
- API middleware: 30 req/min per wallet, sliding window in Redis.
- Relayer: 10 meta-tx per hour per sender, fixed window in DB.
- On-chain: block-based checks for per-block limits.

## Output Format for Agent Implementations
Provide output structured as:

Part 1: Substrate Pallet Implementation
- Full pallet code with config, storage, events, errors, extrinsics, helpers, tests.

Part 2: Backend Services
- Relayer service, API routes, SubQuery config and schema, reconciliation service.

Part 3: Frontend Application
- Next.js pages, wallet integration, admin dashboard, responsive UI.

Part 4: Infrastructure and Deployment
- Dockerfiles, Kubernetes, CI/CD, monitoring, Prisma schema.

Part 5: Testing Suite
- Unit, integration, E2E, load, security tests.

Part 6: Documentation
- API docs, user guide, operator manual, deployment guide.

## Delivery Timeline (Summary)
See `docs/plan.md` for the full roadmap. High level estimate is 48 weeks
for a team of 3 to 4 engineers.

## Answered Open Questions
- Reorg handling: 12 block finality and reorgThreshold 12.
- Oracle failure: 3 layer strategy with degraded mode.
- Bootstrapping agents: treasury seeded agents and early incentives.
- Multi-sig loss: time-locked migration with last resort sudo in early stages.
- Cross-chain: prefer XCM and Snowbridge for Ethereum.
- User education: onboarding security tips and recovery prompts.
- Tax reporting: off-chain CSV exports.
- Governance decentralization: phased transition from team multi-sig to DAO.
