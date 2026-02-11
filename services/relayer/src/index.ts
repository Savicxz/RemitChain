import Fastify from 'fastify';
import fs from 'fs';
import Redis from 'ioredis';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';

const server = Fastify({ logger: true });

const PORT = Number(process.env.RELAYER_PORT ?? 8787);
const API_KEY = process.env.RELAYER_API_KEY;
const CHAIN_WS_URL = process.env.CHAIN_WS_URL ?? 'ws://127.0.0.1:9944';
const RELAYER_SEED = process.env.RELAYER_SEED;
const RELAYER_TX_PALLET = process.env.RELAYER_TX_PALLET ?? 'remitchain';
const RELAYER_TX_METHOD = process.env.RELAYER_TX_METHOD ?? 'sendRemittanceGasless';
const RELAYER_TX_ARGS = (process.env.RELAYER_TX_ARGS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const REQUIRE_SIGNATURE = process.env.RELAYER_REQUIRE_SIGNATURE !== 'false';
const MAX_RETRIES = Number(process.env.RELAYER_MAX_RETRIES ?? 3);
const IDEMPOTENCY_TTL = Number(process.env.RELAYER_IDEMPOTENCY_TTL ?? 3600);
const RELAYER_CHAIN_ID =
  process.env.RELAYER_CHAIN_ID ??
  process.env.CHAIN_ID ??
  process.env.NEXT_PUBLIC_CHAIN_ID ??
  '1337';
const SIGNING_DOMAIN =
  process.env.RELAYER_SIGNING_DOMAIN ?? process.env.SIGNING_DOMAIN ?? 'remitchain';
const SIGNING_ACTION =
  process.env.RELAYER_SIGNING_ACTION ?? process.env.SIGNING_ACTION ?? 'send';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

const QUEUE_KEY = 'relayer:queue';
const JOB_KEY = (id: string) => `relayer:job:${id}`;
const IDEMPOTENCY_KEY = (key: string) => `relayer:idempotency:${key}`;
const NONCE_KEY = (address: string) => `relayer:nonce:${address}`;

const LUA_SET_IF_GREATER = `
local key = KEYS[1]
local incoming = tonumber(ARGV[1])
local current = tonumber(redis.call("GET", key) or "0")
if incoming <= current then
  return 0
end
redis.call("SET", key, tostring(incoming))
return 1
`;

let apiPromise: ApiPromise | null = null;
let apiProvider: WsProvider | null = null;
let signerReady = false;
let signerAddress: string | null = null;

const inMemoryQueue: string[] = [];
const inMemoryJobs = new Map<string, RelayerJob>();
const inMemoryNonces = new Map<string, number>();

type RemittancePayload = {
  from: string;
  to: string;
  amount: string;
  assetId: string;
  corridor: string;
  chainId?: string;
  signature?: string;
  nonce?: number | string;
  deadline?: number | string;
};

type RelayerJob = {
  id: string;
  payload: RemittancePayload;
  status: 'queued' | 'processing' | 'submitted' | 'failed';
  attempts: number;
  createdAt: number;
  updatedAt: number;
  txHash?: string;
  error?: string;
};

type NormalizedPayload = Omit<RemittancePayload, 'nonce' | 'deadline'> & {
  nonce?: number;
  deadline?: number;
};

function requireApiKey(request: { headers: Record<string, unknown> }) {
  if (!API_KEY) {
    return true;
  }

  const header = request.headers['x-relayer-api-key'];
  return header === API_KEY;
}


function loadCustomTypes() {
  const raw = process.env.RELAYER_TYPES_JSON ?? process.env.CHAIN_TYPES_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid RELAYER_TYPES_JSON or CHAIN_TYPES_JSON');
    }
  }

  const typesPath = process.env.RELAYER_TYPES_PATH ?? process.env.CHAIN_TYPES_PATH;
  if (typesPath && fs.existsSync(typesPath)) {
    const contents = fs.readFileSync(typesPath, 'utf-8');
    try {
      return JSON.parse(contents) as Record<string, unknown>;
    } catch {
      throw new Error(`Invalid JSON in types file: ${typesPath}`);
    }
  }

  return undefined;
}

async function getApi() {
  if (apiPromise && apiPromise.isConnected) {
    return apiPromise;
  }

  if (apiProvider) {
    try {
      apiProvider.disconnect();
    } catch {
      // Ignore cleanup errors; we'll recreate the provider below.
    }
    apiProvider = null;
    apiPromise = null;
  }

  const provider = new WsProvider(CHAIN_WS_URL);
  const customTypes = loadCustomTypes();
  provider.on('disconnected', () => {
    apiPromise = null;
    apiProvider = null;
  });
  provider.on('error', () => {
    apiPromise = null;
    apiProvider = null;
  });

  apiProvider = provider;
  apiPromise = await ApiPromise.create({ provider, types: customTypes });
  return apiPromise;
}

async function getSigner() {
  if (!RELAYER_SEED) {
    throw new Error('RELAYER_SEED is required to sign transactions');
  }

  if (!signerReady) {
    await cryptoWaitReady();
    signerReady = true;
  }

  const keyring = new Keyring({ type: 'sr25519' });
  const pair = keyring.addFromUri(RELAYER_SEED);
  signerAddress = pair.address;
  return pair;
}

function buildSigningPayload(
  payload: Required<
    Pick<
      NormalizedPayload,
      'from' | 'to' | 'amount' | 'assetId' | 'corridor' | 'nonce' | 'deadline' | 'chainId'
    >
  >
) {
  return [
    SIGNING_DOMAIN,
    payload.chainId,
    SIGNING_ACTION,
    payload.from,
    payload.to,
    payload.amount,
    payload.assetId,
    payload.corridor,
    String(payload.nonce),
    String(payload.deadline),
  ].join(':');
}

async function verifySignature(payload: NormalizedPayload) {
  if (
    !payload.signature ||
    payload.nonce === undefined ||
    payload.deadline === undefined ||
    !payload.chainId
  ) {
    return false;
  }

  if (String(payload.chainId) !== String(RELAYER_CHAIN_ID)) {
    return false;
  }

  const message = buildSigningPayload({
    from: payload.from,
    to: payload.to,
    amount: payload.amount,
    assetId: payload.assetId,
    corridor: payload.corridor,
    chainId: payload.chainId,
    nonce: payload.nonce,
    deadline: payload.deadline,
  });

  const result = signatureVerify(message, payload.signature, payload.from);
  return result.isValid;
}

async function verifyNonce(payload: NormalizedPayload) {
  if (payload.nonce === undefined) {
    return false;
  }

  if (!redis) {
    const current = inMemoryNonces.get(payload.from) ?? 0;
    if (payload.nonce <= current) {
      return false;
    }
    inMemoryNonces.set(payload.from, payload.nonce);
    return true;
  }

  const key = NONCE_KEY(payload.from);
  const result = await redis.eval(LUA_SET_IF_GREATER, 1, key, payload.nonce);
  return Number(result) === 1;
}

async function verifyDeadline(payload: NormalizedPayload) {
  if (payload.deadline === undefined) {
    return false;
  }

  const api = await getApi();
  const currentBlock = (await api.query.system.number()).toNumber();
  return payload.deadline >= currentBlock;
}

async function getCurrentNonce(address: string) {
  if (redis) {
    const current = await redis.get(NONCE_KEY(address));
    return Number(current ?? 0);
  }

  return inMemoryNonces.get(address) ?? 0;
}

const DEFAULT_GASLESS_ARGS = ['from', 'signature', 'assetId', 'to', 'amount', 'corridor'];
const DEFAULT_STANDARD_ARGS = ['from', 'to', 'amount', 'assetId', 'corridor'];

function resolveTxArgs() {
  if (RELAYER_TX_ARGS.length > 0) {
    return RELAYER_TX_ARGS;
  }

  if (RELAYER_TX_METHOD.toLowerCase().includes('gasless')) {
    return DEFAULT_GASLESS_ARGS;
  }

  return DEFAULT_STANDARD_ARGS;
}

function resolveArgValue(key: string, payload: NormalizedPayload) {
  switch (key) {
    case 'from':
      return payload.from;
    case 'to':
      return payload.to;
    case 'amount':
      return payload.amount;
    case 'assetId':
      return payload.assetId;
    case 'corridor':
      return payload.corridor;
    case 'signature':
      return payload.signature;
    case 'nonce':
      return payload.nonce;
    case 'deadline':
      return payload.deadline;
    case 'chainId':
      if (payload.chainId === undefined || payload.chainId === null) {
        return Number(RELAYER_CHAIN_ID);
      }
      if (typeof payload.chainId === 'number') {
        return payload.chainId;
      }
      if (typeof payload.chainId === 'string') {
        const parsed = Number(payload.chainId);
        if (Number.isNaN(parsed)) {
          throw new Error('Invalid chainId');
        }
        return parsed;
      }
      return Number(RELAYER_CHAIN_ID);
    default:
      return (payload as Record<string, unknown>)[key];
  }
}

async function buildExtrinsic(api: ApiPromise, payload: NormalizedPayload) {
  const pallet = (api.tx as Record<string, Record<string, (...args: unknown[]) => unknown>>)[
    RELAYER_TX_PALLET
  ];
  const method = pallet?.[RELAYER_TX_METHOD];
  if (!method) {
    throw new Error(`${RELAYER_TX_PALLET}.${RELAYER_TX_METHOD} not available on chain`);
  }

  const args = resolveTxArgs().map((key) => {
    const value = resolveArgValue(key, payload);
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing extrinsic arg: ${key}`);
    }
    return value;
  });

  return method(...args);
}

async function submitToChain(payload: NormalizedPayload) {
  const api = await getApi();
  const signer = await getSigner();
  const extrinsic = await buildExtrinsic(api, payload);

  const hash = await (extrinsic as { signAndSend: (signer: unknown) => Promise<{ toHex(): string }> }).signAndSend(
    signer
  );

  return hash.toHex();
}

async function saveJob(job: RelayerJob) {
  if (redis) {
    await redis.set(JOB_KEY(job.id), JSON.stringify(job));
    return;
  }

  inMemoryJobs.set(job.id, job);
}

async function loadJob(id: string) {
  if (redis) {
    const raw = await redis.get(JOB_KEY(id));
    return raw ? (JSON.parse(raw) as RelayerJob) : null;
  }

  return inMemoryJobs.get(id) ?? null;
}

async function enqueueJob(job: RelayerJob) {
  await saveJob(job);

  if (redis) {
    await redis.rpush(QUEUE_KEY, job.id);
  } else {
    inMemoryQueue.push(job.id);
  }
}

async function dequeueJob() {
  if (redis) {
    return redis.lpop(QUEUE_KEY);
  }

  return inMemoryQueue.shift() ?? null;
}

async function processJob(jobId: string) {
  const job = await loadJob(jobId);
  if (!job) {
    return;
  }

  job.status = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  try {
    const txHash = await submitToChain(job.payload);
    job.status = 'submitted';
    job.txHash = txHash;
    job.updatedAt = Date.now();
    await saveJob(job);
  } catch (error) {
    job.attempts += 1;
    job.error = (error as Error).message;
    job.updatedAt = Date.now();

    if (job.attempts <= MAX_RETRIES) {
      job.status = 'queued';
      await enqueueJob(job);
      return;
    }

    job.status = 'failed';
    await saveJob(job);
  }
}

let workerActive = false;
setInterval(async () => {
  if (workerActive) return;
  workerActive = true;
  try {
    const jobId = await dequeueJob();
    if (jobId) {
      await processJob(jobId);
    }
  } finally {
    workerActive = false;
  }
}, 1000);

server.get('/health', async () => {
  let chainOk = false;
  let chainBlock: number | null = null;
  let chainError: string | null = null;

  try {
    const api = await getApi();
    chainOk = api.isConnected;
    if (chainOk) {
      const block = await api.query.system.number();
      chainBlock = block.toNumber();
    }
  } catch (error) {
    chainError = (error as Error).message;
  }

  return {
    ok: chainOk,
    service: 'relayer',
    status: chainOk ? 'ready' : 'degraded',
    redis: redis ? redis.status : 'disabled',
    signer: signerAddress ?? 'uninitialized',
    chain: {
      ok: chainOk,
      endpoint: CHAIN_WS_URL,
      block: chainBlock,
      error: chainError,
    },
  };
});

server.get('/remittance/status/:id', async (request, reply) => {
  if (!requireApiKey(request)) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const id = (request.params as { id: string }).id;
  const job = await loadJob(id);
  if (!job) {
    return reply.status(404).send({ error: 'Not found' });
  }

  return reply.send({ ok: true, job });
});

server.get('/nonce/:address', async (request, reply) => {
  if (!requireApiKey(request)) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const address = (request.params as { address?: string }).address;
  if (!address) {
    return reply.status(400).send({ error: 'Address required' });
  }

  const current = await getCurrentNonce(address);
  return reply.send({ ok: true, current, next: current + 1 });
});

server.post('/remittance/send', async (request, reply) => {
  if (!requireApiKey(request)) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
  const payload = request.body as RemittancePayload;

  if (!payload?.from || !payload?.to || !payload?.amount || !payload?.assetId || !payload?.corridor) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  const normalizedPayload: NormalizedPayload = {
    ...payload,
    nonce:
      payload.nonce === undefined
        ? undefined
        : typeof payload.nonce === 'string'
        ? Number(payload.nonce)
        : payload.nonce,
    deadline:
      payload.deadline === undefined
        ? undefined
        : typeof payload.deadline === 'string'
        ? Number(payload.deadline)
        : payload.deadline,
  };

  const payloadHash = JSON.stringify(normalizedPayload);

  if (redis && idempotencyKey) {
    const cached = await redis.get(IDEMPOTENCY_KEY(idempotencyKey));
    if (cached) {
      const parsed = JSON.parse(cached) as { payloadHash: string; response: unknown };
      if (parsed.payloadHash !== payloadHash) {
        return reply.status(409).send({ error: 'Idempotency key conflict' });
      }
      return reply.send(parsed.response);
    }
  }

  if (REQUIRE_SIGNATURE) {
    if (
      !normalizedPayload.signature ||
      normalizedPayload.nonce === undefined ||
      normalizedPayload.deadline === undefined ||
      !normalizedPayload.chainId ||
      Number.isNaN(normalizedPayload.nonce) ||
      Number.isNaN(normalizedPayload.deadline)
    ) {
      return reply
        .status(400)
        .send({ error: 'Signature, nonce, deadline, and chainId required' });
    }

    const isSignatureValid = await verifySignature(normalizedPayload);
    if (!isSignatureValid) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }

    const isDeadlineValid = await verifyDeadline(normalizedPayload);
    if (!isDeadlineValid) {
      return reply.status(400).send({ error: 'Deadline expired' });
    }

    const isNonceValid = await verifyNonce(normalizedPayload);
    if (!isNonceValid) {
      return reply.status(400).send({ error: 'Invalid nonce' });
    }
  }

  const job: RelayerJob = {
    id: `relayer_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    payload: normalizedPayload,
    status: 'queued',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await enqueueJob(job);

  const response = {
    ok: true,
    relayerId: job.id,
    status: job.status,
  };

  if (redis && idempotencyKey) {
    await redis.set(
      IDEMPOTENCY_KEY(idempotencyKey),
      JSON.stringify({ payloadHash, response }),
      'EX',
      IDEMPOTENCY_TTL
    );
  }

  return reply.status(202).send(response);
});

server.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});
