# RemitChain Codebase Audit

> **Scope:** Every source file across `src/`, `services/relayer/`, `subquery/`, `scripts/`, config, and `docs/`.  
> **Date:** 2026-02-11  
> **Reference docs:** [truth.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/truth.md) · [architecture-review.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/architecture-review.md) · [plan.md](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/docs/plan.md)

---

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 3 | 4 | 2 | — |
| Bugs / Correctness | 1 | 3 | 3 | 2 |
| Spec Misalignment | — | 4 | 2 | — |
| Missing Implementation | — | 2 | 3 | — |
| **Total** | **4** | **13** | **10** | **2** |

---

## 🔴 Critical Issues

### C1. Notify API has no authentication
**File:** [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/notify/route.ts)

Anyone can call `POST /api/notify` to send SMS or push notifications at your expense. No API key, no auth check, no rate limiting.

```diff
 export async function POST(request: Request) {
+  const apiKey = request.headers.get('x-api-key');
+  if (apiKey !== process.env.INTERNAL_API_KEY) {
+    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
+  }
+
+  const limitResult = await checkRateLimit(`notify:${request.headers.get('x-forwarded-for') ?? 'unknown'}`);
+  if (!limitResult.success) {
+    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
+  }
```

**Risk:** Financial abuse (Twilio bill), spam push notifications, reputational damage.

---

### C2. Relayer status endpoint has no API key check
**File:** [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/src/index.ts#L326-L334)

`GET /remittance/status/:id` skips `requireApiKey()`. Any external caller can enumerate job IDs and leak transaction details (sender, recipient, amount, corridor).

```diff
 server.get('/remittance/status/:id', async (request, reply) => {
+  if (!requireApiKey(request)) {
+    return reply.status(401).send({ error: 'Unauthorized' });
+  }
+
   const id = (request.params as { id: string }).id;
```

**Risk:** Information disclosure of all relayer jobs.

---

### C3. Relayer seed phrase is in a committed `.env` file
**File:** [.env](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/.env#L3)

`RELAYER_SEED=//Alice` is a dev-only value, but the `.env` file itself is committed to the repo (not gitignored). Real credentials will be committed if someone edits this file for production.

**Fix:** Add `services/relayer/.env` to `.gitignore`. Only commit `.env.example`.

---

### C4. Redis client is instantiated on every call
**File:** [redis.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/redis.ts)

`getRedis()` creates a new `Redis.fromEnv()` instance on every import/call. Each call opens a new HTTP connection to Upstash. This will hit connection limits fast under production load.

```diff
+let cached: Redis | null | undefined;
+
 export function getRedis() {
+  if (cached !== undefined) return cached;
   if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
+    cached = null;
     return null;
   }
-  return Redis.fromEnv();
+  cached = Redis.fromEnv();
+  return cached;
 }
```

**Risk:** Connection exhaustion, rate limiting from Upstash, and cost blowout under load.

---

## 🟠 High-Severity Issues

### H1. Chain API singleton never reconnects on disconnect
**File:** [chain.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/chain.ts#L5-L14)

`getApi()` caches the first `ApiPromise` forever. If the WebSocket drops (which is normal), every subsequent call uses a dead connection silently.

```diff
 export async function getApi() {
-  if (apiPromise) {
+  if (apiPromise && apiPromise.isConnected) {
     return apiPromise;
   }
```

Also add a `provider.on('disconnected', ...)` handler to clear the cache.

---

### H2. Chain head API has no error handling
**File:** [route.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/api/chain/head/route.ts)

If the chain is unreachable, `getApi()` throws an unhandled promise rejection, crashing the serverless function instead of returning a proper error.

```diff
 export async function GET() {
-  const api = await getApi();
-  const block = await api.query.system.number();
-  return NextResponse.json({ block: block.toNumber() });
+  try {
+    const api = await getApi();
+    const block = await api.query.system.number();
+    return NextResponse.json({ block: block.toNumber() });
+  } catch {
+    return NextResponse.json({ error: 'Chain unavailable' }, { status: 503 });
+  }
 }
```

---

### H3. Fee is not deducted from recipient amount
**File:** [send-flow/index.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/send-flow/index.tsx#L64-L69)

```typescript
const fee = (numericAmount * (selectedCorridor.fee / 100)).toFixed(2);
const finalAmount = (numericAmount * selectedCorridor.rate).toLocaleString();
```

`finalAmount` is calculated on the **full** amount, not `amount - fee`. The user sees a bigger number than they'll actually receive. This is misleading for a financial product.

```diff
-return (numericAmount * selectedCorridor.rate).toLocaleString();
+const afterFee = numericAmount * (1 - selectedCorridor.fee / 100);
+return (afterFee * selectedCorridor.rate).toLocaleString();
```

---

### H4. Amount input accepts negative and non-numeric values
**File:** [step-amount.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/send-flow/step-amount.tsx#L18-L21)

`type="number"` still allows `e`, `+`, `-`, and empty strings on some browsers. `parseFloat("")` returns `NaN`, and `parseFloat("-5")` returns `-5`. The "Continue" button check only validates `> 0` and `< balance` but doesn't protect against NaN.

Add input sanitization:
```typescript
onChange={(event) => {
  const v = event.target.value;
  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
}}
```

---

### H5. WalletConnect v1 is deprecated (resolved)
**File:** [wallet-connect.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/wallet-connect.tsx#L6)

WalletConnect v1 has been replaced with WalletConnect v2 using `@walletconnect/ethereum-provider`. The fallback now requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local`.

---

### H6. `submitRemittancePlaceholder` returns fake data in production
**File:** [chain.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/chain.ts#L28-L42)

This function always returns a fake hash (`0xplaceholder_...`) regardless of environment. If the relayer is not configured, the API route falls through to this and tells the user their transfer succeeded when nothing happened on-chain.

**Fix:** Either throw an error when `RELAYER_URL` is not set, or guard the fallback path:
```diff
+if (process.env.NODE_ENV === 'production') {
+  return NextResponse.json({ error: 'Relayer not configured' }, { status: 503 });
+}
 const chainResult = await submitRemittancePlaceholder(payload);
```

---

### H7. Relayer worker only processes 1 job per second
**File:** [relayer/index.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/src/index.ts#L303-L314)

`setInterval(..., 1000)` processes at most 1 job/sec. Under load, the queue grows unboundedly. The truth.md spec targets 100 TPS.

**Fix:** Process in batches or use a proper job queue (BullMQ) instead of a polling loop:
```typescript
// Process multiple jobs without waiting for interval
async function drainQueue() {
  let jobId = await dequeueJob();
  while (jobId) {
    await processJob(jobId);
    jobId = await dequeueJob();
  }
}
```

---

## 🟡 Medium Issues

### M1. Rate limit middleware only matches `/api/remittance` exactly
**File:** [middleware.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/middleware.ts#L30)

```typescript
matcher: ['/api/remittance'],
```

This does NOT match `/api/remittance/status/xxx`, `/api/notify`, `/api/nonce`, or `/api/chain/head`. Those routes have zero rate limiting from the middleware.

```diff
-matcher: ['/api/remittance'],
+matcher: ['/api/:path*'],
```

---

### M2. Only 3 of 5 corridors shown in send flow
**File:** [step-corridor.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/send-flow/step-corridor.tsx#L20)

```typescript
{corridors.slice(0, 3).map((c) => (
```

Vietnam and another corridor are silently hidden. This looks intentional for UI space but there's no "Show more" option — users can never select them.

---

### M3. Simulated KYC auto-upgrade via timer
**File:** [auth-gate.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/auth-gate.tsx#L19-L26)

KYC automatically upgrades from Tier 1 to Tier 2 after 3 seconds via `setTimeout`. This is mock behavior that bypasses actual verification. Must not ship to production.

---

### M4. Hardcoded `assetId: 'USDC'` — no multi-asset support in UI
**File:** [send-flow/index.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/components/features/send-flow/index.tsx#L143)

The truth.md spec requires USDC, USDT, DAI, jMYR, and jPHP. The UI hardcodes USDC everywhere with no asset selector.

---

### M5. SubQuery manifest placeholders (resolved)
**File:** [project.yaml](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/subquery/project.yaml#L16-L17)

`project.yaml` now uses a concrete Polkadot default and `project.ts` supports env overrides via `SUBQUERY_ENDPOINT` and `SUBQUERY_CHAIN_ID`.

---

### M6. Middleware rate limit and `ratelimit.ts` are duplicate implementations
**Files:** [middleware.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/middleware.ts) and [ratelimit.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/ratelimit.ts)

Both create independent Upstash `Ratelimit` instances with different configs (middleware: 5/min, lib: 5/min). A request hits both, so the effective limit is ambiguous. Consolidate into one module.

---

### M7. Emoji flags render as `????` on some systems
**File:** [data.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/lib/data.ts#L21-L26)

The flag emojis show as `????` in the source. This seems to be an encoding issue. On Windows terminals and some browsers, country flag emojis don't render. Consider using SVG flag icons instead.

---

### M8. Relayer double-enqueues on retry
**File:** [relayer/index.ts](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/services/relayer/src/index.ts#L285-L294)

```typescript
if (job.attempts <= MAX_RETRIES) {
  job.status = 'queued';
  await saveJob(job);
  await enqueueJob(job); // ← saves AND enqueues again
}
```

`enqueueJob()` calls `saveJob()` internally, so the job is saved twice. More critically, if `saveJob` succeeds but `enqueueJob` fails (e.g., Redis timeout), the job is stuck in "queued" status but never re-enqueued.

**Fix:** Only call `enqueueJob`:
```diff
-  await saveJob(job);
   await enqueueJob(job);
```

---

## 🔵 Low Issues

### L1. `add Funds` button does nothing
**File:** [page.tsx](file:///c:/Users/User/Desktop/Project/VSCode/RemitChain/src/app/(dashboard)/page.tsx#L34)

The "Add Funds" button has no `onClick` handler. It renders but does nothing.

---

### L2. No `.gitignore` visible in project root
There's no gitignore to prevent `.env.local`, `services/relayer/.env`, `node_modules`, and `.next/` from being committed.

---

## 📋 Spec ↔ Code Alignment

| truth.md Requirement | Code Status | Gap |
|----------------------|-------------|-----|
| Gasless meta-transactions with nonce/deadline/chainId | ✅ Implemented in `signing.ts` + relayer | — |
| Multi-stablecoin support (USDC, USDT, DAI, jMYR, jPHP) | ❌ UI hardcoded to USDC only | Add asset selector |
| Circuit breaker with tiered thresholds | ❌ Not implemented (chain not live) | Expected — blocked on pallet |
| Privacy KYC (Merkle/SBT) | ❌ Simulated via timer | Replace with real KYC flow |
| Agent staking with stablecoin bond | ❌ Not implemented | Blocked on pallet |
| Dispute bond (5% of remittance) | ❌ Not implemented | Blocked on pallet |
| Compliance APIs | ❌ No compliance endpoints exist | Build `/api/compliance/*` |
| Reorg-safe 12-block confirmation | ❌ Not implemented in UI/API | Add confirmation counter |
| Rate limiting architecture (4-layer) | 🟡 Partial — only 2 layers | Add edge + on-chain layers |
| Prisma schema | ❌ Not implemented — no `schema.prisma` file | Create + migrate |
| Health endpoint with subsystem status | 🟡 Relayer has basic `/health` | Add chain/db/indexer/oracle |
| Localization (10+ languages) | ❌ No i18n setup | Add `next-intl` or similar |
| WCAG 2.1 AA accessibility | 🟡 Keyboard nav on corridors but missing labels/ARIA | Audit with axe |
| WebSocket subscriptions for real-time updates | ❌ Uses polling (2s interval) | Add WS subscription |

---

## 🎯 Prioritized Fix Order

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| 1 | **C1** — Auth on notify API | Prevent financial abuse | 15 min |
| 2 | **C2** — Auth on relayer status | Prevent info disclosure | 5 min |
| 3 | **C3** — Gitignore `.env` files | Prevent credential leak | 5 min |
| 4 | **C4** — Singleton Redis client | Prevent connection exhaustion | 10 min |
| 5 | **H3** — Fix fee deduction from recipient amount | Correct financial calculation | 10 min |
| 6 | **H6** — Guard placeholder chain submission | Prevent false success | 10 min |
| 7 | **H1** — Chain API reconnect handling | Prevent dead connections | 20 min |
| 8 | **H2** — Error handling for chain head route | Prevent crashes | 5 min |
| 9 | **H4** — Amount input sanitization | Prevent invalid transactions | 15 min |
| 10 | **H5** - WalletConnect v2 upgrade (done) | n/a | n/a |
| 11 | **M8** — Fix relayer double-enqueue on retry | Prevent duplicate saves | 5 min |
| 12 | **M1** — Expand middleware rate limit matcher | Close rate limit bypass | 5 min |
| 13 | **M3** — Remove simulated KYC timer | Prevent auto-verification | 5 min |
| 14 | **H7** — Relayer batch processing | Enable throughput scaling | 1 hr |
| 15 | **M4** — Add multi-asset selector to UI | Align with spec | 2 hr |
