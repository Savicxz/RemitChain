# RemitChain Delivery Plan

## Assumptions
- Team size: 3 to 4 engineers with one part-time DevOps focus.
- External security audit required before mainnet launch.
- Parallel workstreams are possible after pallet decomposition.

## Phases and Milestones

Phase 0 (Weeks 1-2): Foundations
- Repo structure, CI/CD skeleton, Docker Compose, local dev setup.
- Decide pallet boundaries and create crates with scaffolding.
- Define API contract and event schema.

Exit criteria:
- CI builds green.
- Local chain, API, DB, and indexer can boot together.

Phase 1 (Weeks 3-8): Core Pallets and Assets
- `pallet-remitchain`, `pallet-kyc` base functionality.
- `pallet-assets` integration and multi-asset transfers.
- Initial events and storage schema.

Exit criteria:
- Basic remittance flow on testnet with stablecoins.

Phase 2 (Weeks 9-14): Gasless Relayer and Escrow
- Relayer service with nonce, deadline, and rate limits.
- Escrow lock and release logic.
- Agent onboarding in `pallet-agents` with stablecoin bond.

Exit criteria:
- Gasless transaction flow works end to end.

Phase 3 (Weeks 15-20): Compliance, Disputes, Oracles
- `pallet-compliance` velocity checks and flags.
- `pallet-disputes` with dispute bond and arbitration flow.
- Oracle pallet with degraded mode and circuit breaker tiers.

Exit criteria:
- Depeg safety and compliance limits enforced on-chain.

Phase 4 (Weeks 21-26): Indexing and Reconciliation
- SubQuery schemas and mappings.
- Reconciliation service and alerting.
- Reorg handling and 12-block confirmation logic.

Exit criteria:
- Indexer is stable with reorg-safe UI status.

Phase 5 (Weeks 27-34): Frontend and Admin Dashboard
- Wallet integration, send flow, status tracking.
- Admin compliance views and dispute handling.
- Localization and accessibility baseline.

Exit criteria:
- Full user and admin flows in staging.

Phase 6 (Weeks 35-38): Testing and Hardening
- Unit, integration, E2E, and load tests.
- Chaos testing for node, indexer, and oracle outages.
- Security scanning in CI.

Exit criteria:
- Test suite passes with target coverage.

Phase 7 (Weeks 39-42): Security Audit and Fixes
- External audit and remediation.
- Pen-test and operational runbooks.

Exit criteria:
- Audit findings resolved or mitigated.

Phase 8 (Weeks 43-46): Staging and Partner Onboarding
- Staging deployment with monitoring.
- Liquidity partner onboarding and pilot corridors.
- DR drills and incident response rehearsal.

Exit criteria:
- Staging ready for production cutover.

Phase 9 (Weeks 47-48): Mainnet Launch
- Production rollout.
- 24/7 monitoring and escalation plan.

Exit criteria:
- Mainnet live with active monitoring and support.

## Risks and Mitigations
- Oracle failure: degraded mode and admin emergency prices.
- Relayer compromise: rotate keys and revoke on-chain immediately.
- Compliance scope creep: strict on-chain vs off-chain split.
- Timeline risk: keep pallet decomposition and parallel teams.

## Immediate Next Steps
- Confirm corridor list and initial stablecoins.
- Decide KYC provider and data retention policy.
- Pick cloud provider and infrastructure IaC tool.
- Start pallet scaffolding and testnet setup.
