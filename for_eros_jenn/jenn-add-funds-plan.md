# Jenn Plan: Add Funds

Owner: Jenn
Branch: `feature/add-funds-flow`
Primary goal: make `Add Funds` fully usable in dev mode.

## Scope
- Add working `Add Funds` UI flow from dashboard.
- Add backend endpoint to validate and accept add-funds requests.
- Update wallet balances and transaction history after successful add-funds.

## Files To Touch
- `src/app/(dashboard)/page.tsx`
- `src/store/use-wallet-store.ts`
- `src/app/api/funds/add/route.ts` (new)
- Optional: `src/lib/data.ts` if transaction typing needs extension

## Implementation Checklist
1. Wire `Add Funds` button to open modal.
2. Build modal with:
- asset selector
- amount input
- submit/cancel buttons
3. Add store action:
- `addFunds(amount, assetId, meta?)`
4. Add API route with validation:
- require auth session
- `amount > 0`
- allowed `assetId`
5. On success:
- update balance in store
- prepend `COMPLETED` positive transaction row
6. On failure:
- show clear error in UI

## Acceptance Criteria
- `Add Funds` button opens the new modal.
- Valid submission increases displayed balance.
- New positive transaction is visible immediately.
- Invalid amount or bad asset returns clear error and no balance mutation.

## Test Steps
1. Login as dev wallet user.
2. Add `100 USDC` and confirm dashboard balance increases.
3. Add invalid values (`0`, negative, non-number) and confirm rejection.
4. Confirm recent transactions includes `+100.00 USDC` with status `COMPLETED`.

## PR Checklist
- Branch pushed to `feature/add-funds-flow`.
- CI checks green.
- PR includes screenshot of modal and updated balance.
