# RemitChain Relayer Service

## Overview
Queue-based relayer for gasless remittance submissions. Validates signatures and nonces, persists jobs in Redis, and submits to chain via `@polkadot/api`.

## Endpoints
- `GET /health`
- `POST /remittance/send`
- `GET /remittance/status/:id`
- `GET /nonce/:address`

## Env
- `RELAYER_PORT` (default 8787)
- `RELAYER_API_KEY` (optional)
- `RELAYER_SEED` (required for chain submission)
- `RELAYER_TX_METHOD` (default `sendRemittanceGasless`)
- `RELAYER_REQUIRE_SIGNATURE` (default `true`)
- `RELAYER_MAX_RETRIES` (default 3)
- `RELAYER_IDEMPOTENCY_TTL` (default 3600 seconds)
- `RELAYER_CHAIN_ID` (default `remitchain-local`)
- `CHAIN_WS_URL` (default `ws://127.0.0.1:9944`)
- `REDIS_URL` (recommended for queue persistence)

## Request Payload
```
{
  "from": "5F...",
  "to": "5G...",
  "amount": "100",
  "assetId": "USDC",
  "corridor": "PH",
  "chainId": "remitchain-local",
  "signature": "0x...",
  "nonce": 1,
  "deadline": 123456
}
```

Signature is verified against the payload string:
`remitchain:{chainId}:send:from:to:amount:assetId:corridor:nonce:deadline`

## Idempotency
Send `Idempotency-Key` header to safely retry the same request. Conflicting payloads return `409`.

## Nonce Handling
Nonces are enforced atomically in Redis (Lua compare-and-set). Use `/nonce/:address` to fetch the next nonce before signing.

## Run
```
cd services/relayer
npm install
npm run dev
```
