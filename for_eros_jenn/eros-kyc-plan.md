# Eros Plan: KYC Enforcement

Owner: Eros
Branch: `feature/mock-kyc-enforcement`
Primary goal: enforce KYC tier limits in remittance API flow.

## Scope
- Use existing dev endpoint `POST /api/dev/kyc-tier` to set user tier.
- Enforce daily send limits by KYC tier in remittance API.
- Return deterministic error payload when blocked.

## Tier Policy
- Tier 0: cannot send
- Tier 1: max `1000` per 24h
- Tier 2: max `10000` per 24h
- Tier 3: max `50000` per 24h

## Files To Touch
- `src/app/api/remittance/route.ts`
- Optional UI/dev controls: `src/app/(dashboard)/compliance/page.tsx`
- Optional schema typing: `src/lib/compliance-schemas.ts`

## Implementation Checklist
1. Resolve sender wallet to `User`.
2. Read `kycTier`.
3. Calculate sender total remittance amount in last 24h.
4. Reject when new amount exceeds tier limit.
5. Return consistent error payload:
- `errorCode` (example: `KYC_LIMIT_EXCEEDED`)
- `kycTier`
- `dailyLimit`
- `remainingLimit`
6. Ensure frontend shows returned error clearly in send flow.

## Acceptance Criteria
- Tier 0 sender is blocked every time.
- Tier 1/2/3 enforce correct daily limit.
- Exceeding limit returns stable structured error.
- Valid sends below limit continue normally.

## Test Steps
1. Set tier to 1 via:
```bash
curl -X POST http://localhost:3000/api/dev/kyc-tier \
  -H "Content-Type: application/json" \
  -d '{"address":"<WALLET_A>","kycTier":1}'
```
2. Send amount below limit and confirm success.
3. Send again until limit exceeded and confirm rejection payload.
4. Set tier to 2 and confirm higher limit behavior.

## PR Checklist
- Branch pushed to `feature/mock-kyc-enforcement`.
- CI checks green.
- PR includes sample success and rejection API responses.
