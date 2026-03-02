# Two-Person Plan Index

This folder now has split plans by owner:

1. Jenn (`Add Funds`): `for_eros_jenn/jenn-add-funds-plan.md`
2. Eros (`KYC Enforcement`): `for_eros_jenn/eros-kyc-plan.md`

## Branch Strategy
- Jenn branch: `feature/add-funds-flow`
- Eros branch: `feature/mock-kyc-enforcement`

## Shared Setup
```bash
git fetch origin
git switch main
git pull origin main
npm install
cp .env.codespaces.example .env.local
npm run dev:remote
```

## Integration Rule
- Jenn owns funding flow and balance update.
- Eros owns send-limit enforcement and KYC error responses.
- Funding must not bypass KYC checks in remittance send path.
