import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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

const RELAYER_ROOT = process.cwd();
const REPO_ROOT = path.resolve(RELAYER_ROOT, '..', '..');
const SUBQUERY_GRAPHQL_URL = process.env.SUBQUERY_GRAPHQL_URL ?? 'http://127.0.0.1:3001';
const SUBQUERY_SCHEMA = process.env.SUBQUERY_NAME ?? 'remitchain-indexer';
const DEV_STATUS_FILE =
  process.env.DEV_STATUS_FILE ?? path.join(REPO_ROOT, 'ops', 'dev-status.json');
const DEV_IDENTITIES_PATH =
  process.env.DEV_IDENTITIES_PATH ?? path.join(REPO_ROOT, 'config', 'dev-identities.json');
const ENFORCE_DEV_IDENTITY = process.env.RELAYER_ENFORCE_DEV_IDENTITY === 'true';
const RESET_TOKEN = process.env.RELAYER_RESET_TOKEN ?? '';
const RESET_COOLDOWN_SEC = Number(process.env.RELAYER_RESET_COOLDOWN_SEC ?? 300);
const RESET_TIMEOUT_MS = Number(process.env.RELAYER_RESET_TIMEOUT_MS ?? 10 * 60 * 1000);
const RESET_SCRIPT =
  process.env.RELAYER_RESET_SCRIPT ?? path.join(REPO_ROOT, 'ops', 'reset-dev-chain.sh');
const RESET_ALLOWED_IPS = (process.env.RELAYER_RESET_ALLOWED_IPS ?? '127.0.0.1,::1')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

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

let resetInProgress = false;
let lastResetAt = 0;
const resetJobs = new Map<string, ResetJob>();

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
  payload: NormalizedPayload;
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

type DevIdentity = {
  id: string;
  devIndex: number;
  address: string;
  seed?: string;
};

type DevIdentityConfig = {
  version?: number;
  teammates?: DevIdentity[];
};

type ResetJob = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  requestedBy?: string;
  output?: string;
  error?: string;
};

const devIdentityMap = loadDevIdentityMap();

function getHeader(request: { headers: Record<string, unknown> }, name: string) {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function requireApiKey(request: { headers: Record<string, unknown> }) {
  if (!API_KEY) {
    return true;
  }

  const header = getHeader(request, 'x-relayer-api-key');
  return header === API_KEY;
}

function normalizeIdentityKey(value: string) {
  return value.trim().toLowerCase();
}

function loadDevIdentityMap() {
  const map = new Map<string, DevIdentity>();
  if (!fs.existsSync(DEV_IDENTITIES_PATH)) {
    return map;
  }

  try {
    const raw = fs.readFileSync(DEV_IDENTITIES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DevIdentityConfig | DevIdentity[];
    const teammates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.teammates)
      ? parsed.teammates
      : [];

    for (const teammate of teammates) {
      if (!teammate || !teammate.id || !teammate.address) {
        continue;
      }
      map.set(normalizeIdentityKey(teammate.id), {
        id: teammate.id,
        devIndex: Number(teammate.devIndex ?? 0),
        address: teammate.address,
        seed: teammate.seed,
      });
    }
  } catch (error) {
    server.log.warn(`Failed to load dev identities: ${(error as Error).message}`);
  }

  return map;
}

function findIdentityByAddress(address: string) {
  for (const identity of devIdentityMap.values()) {
    if (identity.address === address) {
      return identity;
    }
  }
  return null;
}

function enforceDevIdentity(request: { headers: Record<string, unknown> }, address: string) {
  if (!ENFORCE_DEV_IDENTITY) {
    return null;
  }

  if (devIdentityMap.size === 0) {
    return 'Dev identity enforcement enabled but no identity map configured';
  }

  const devIdentityHeader =
    getHeader(request, 'x-dev-identity') ?? process.env.DEV_IDENTITY ?? undefined;
  if (devIdentityHeader) {
    const identity = devIdentityMap.get(normalizeIdentityKey(devIdentityHeader));
    if (!identity) {
      return `Unknown dev identity '${devIdentityHeader}'`;
    }
    if (identity.address !== address) {
      return `Address ${address} does not match assigned identity ${identity.id}`;
    }
    return null;
  }

  const match = findIdentityByAddress(address);
  if (!match) {
    return `Address ${address} is not in allowed dev identity map`;
  }

  return null;
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
  apiPromise = await ApiPromise.create({ provider, types: customTypes as any });
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
  const currentBlock = Number((await api.query.system.number()).toString());
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

  const hash = await (
    extrinsic as { signAndSend: (signer: unknown) => Promise<{ toHex(): string }> }
  ).signAndSend(signer);

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

function ipv4ToInt(ip: string) {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  const values = parts.map((part) => Number(part));
  if (values.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return null;
  }

  return (
    values[0] * 256 * 256 * 256 +
    values[1] * 256 * 256 +
    values[2] * 256 +
    values[3]
  );
}

function matchesIpRule(ip: string, rule: string) {
  if (rule === ip) {
    return true;
  }

  if (rule.endsWith('*')) {
    return ip.startsWith(rule.slice(0, -1));
  }

  if (rule.endsWith('.')) {
    return ip.startsWith(rule);
  }

  if (rule.includes('/')) {
    const [network, prefixValue] = rule.split('/');
    const prefix = Number(prefixValue);
    const ipInt = ipv4ToInt(ip);
    const networkInt = ipv4ToInt(network);
    if (ipInt === null || networkInt === null || Number.isNaN(prefix)) {
      return false;
    }
    const safePrefix = Math.max(0, Math.min(32, prefix));
    const mask = safePrefix === 0 ? 0 : 0xffffffff << (32 - safePrefix);
    return (ipInt & mask) === (networkInt & mask);
  }

  return false;
}

function getRequestIp(request: { ip?: string; headers: Record<string, unknown> }) {
  const xForwardedFor = getHeader(request, 'x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return request.ip ?? '';
}

function isResetIpAllowed(ip: string) {
  if (!ip) {
    return false;
  }
  if (RESET_ALLOWED_IPS.length === 0) {
    return false;
  }

  return RESET_ALLOWED_IPS.some((rule) => matchesIpRule(ip, rule));
}

function readDevStatusFile() {
  if (!fs.existsSync(DEV_STATUS_FILE)) {
    return {} as Record<string, unknown>;
  }

  try {
    const raw = fs.readFileSync(DEV_STATUS_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

async function fetchSubqueryHead() {
  try {
    const response = await fetch(SUBQUERY_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ _metadata { lastProcessedHeight targetHeight } }',
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `status ${response.status}` };
    }

    const body = (await response.json()) as {
      data?: { _metadata?: { lastProcessedHeight?: string; targetHeight?: string } };
      errors?: unknown;
    };

    const metadata = body.data?._metadata;
    if (!metadata) {
      return { ok: false, error: 'missing metadata' };
    }

    const lastProcessed = Number(metadata.lastProcessedHeight ?? 0);
    const target = Number(metadata.targetHeight ?? 0);
    if (Number.isNaN(lastProcessed) || Number.isNaN(target)) {
      return { ok: false, error: 'invalid metadata values' };
    }

    return {
      ok: true,
      lastProcessedHeight: lastProcessed,
      targetHeight: target,
      lag: Math.max(0, target - lastProcessed),
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message,
    };
  }
}

async function buildDevStatus() {
  const statusFile = readDevStatusFile();
  const generatedAt = new Date().toISOString();

  let chainOk = false;
  let chainBlock: number | null = null;
  let chainError: string | null = null;
  let chainId: string | null = null;
  let genesisHash: string | null = null;
  let rpcLatencyMs: number | null = null;

  try {
    const api = await getApi();
    const started = Date.now();
    const block = await api.query.system.number();
    rpcLatencyMs = Date.now() - started;
    chainBlock = Number(block.toString());
    chainId = String(api.runtimeVersion.specVersion.toString());
    genesisHash = api.genesisHash.toHex();
    chainOk = api.isConnected;
  } catch (error) {
    chainError = (error as Error).message;
  }

  const subqueryStatus = await fetchSubqueryHead();

  return {
    version: 1,
    generatedAt,
    chain: {
      wsUrl: CHAIN_WS_URL,
      chainId,
      genesisHash,
      block: chainBlock,
      rpcLatencyMs,
      error: chainError,
    },
    subquery: {
      graphqlUrl: SUBQUERY_GRAPHQL_URL,
      schema: SUBQUERY_SCHEMA,
      ...subqueryStatus,
    },
    seed: statusFile.seed ?? null,
    contracts: statusFile.contracts ?? {},
    metadataVersion: statusFile.metadataVersion ?? null,
    health: {
      chainReady: chainOk,
      subqueryReady: Boolean((subqueryStatus as { ok?: boolean }).ok),
      redis: redis ? redis.status : 'disabled',
    },
  };
}

function createResetJob(requestedBy: string) {
  const id = `reset_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const job: ResetJob = {
    id,
    status: 'queued',
    requestedAt: new Date().toISOString(),
    requestedBy,
  };
  resetJobs.set(id, job);
  return job;
}

function runResetJob(job: ResetJob) {
  const child = spawn(RESET_SCRIPT, [], {
    cwd: REPO_ROOT,
    shell: true,
    env: process.env,
  });

  job.status = 'running';
  job.startedAt = new Date().toISOString();
  resetInProgress = true;

  let output = '';
  const timeout = setTimeout(() => {
    output += '\n[relayer] reset timeout exceeded\n';
    child.kill('SIGTERM');
  }, RESET_TIMEOUT_MS);

  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });

  child.stderr.on('data', (chunk) => {
    output += String(chunk);
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    job.finishedAt = new Date().toISOString();
    job.exitCode = code ?? 1;
    job.output = output.slice(-12000);
    job.status = code === 0 ? 'succeeded' : 'failed';
    if (code !== 0 && !job.error) {
      job.error = `reset script exited with code ${code}`;
    }
    resetInProgress = false;
    lastResetAt = Date.now();
  });

  child.on('error', (error) => {
    clearTimeout(timeout);
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.error = error.message;
    job.output = output.slice(-12000);
    resetInProgress = false;
    lastResetAt = Date.now();
  });
}

server.get('/health', async () => {
  let chainOk = false;
  let chainBlock: number | null = null;
  let chainError: string | null = null;

  try {
    const api = await getApi();
    chainOk = api.isConnected;
    if (chainOk) {
      const block = await api.query.system.number();
      chainBlock = Number(block.toString());
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

server.get('/dev/status', async (_request, reply) => {
  const status = await buildDevStatus();
  return reply.send(status);
});

server.post('/dev/reset', async (request, reply) => {
  const resetToken = getHeader(request, 'x-reset-token');
  if (!RESET_TOKEN || resetToken !== RESET_TOKEN) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const requestIp = getRequestIp(request);
  if (!isResetIpAllowed(requestIp)) {
    return reply.status(403).send({ error: `Reset not allowed from IP ${requestIp}` });
  }

  if (resetInProgress) {
    return reply.status(409).send({ error: 'Reset already in progress' });
  }

  if (lastResetAt > 0) {
    const elapsed = Math.floor((Date.now() - lastResetAt) / 1000);
    if (elapsed < RESET_COOLDOWN_SEC) {
      return reply.status(429).send({
        error: `Reset cooldown active. Retry in ${RESET_COOLDOWN_SEC - elapsed}s`,
      });
    }
  }

  const requestedBy = getHeader(request, 'x-dev-identity') ?? requestIp;
  const job = createResetJob(requestedBy);
  runResetJob(job);
  return reply.status(202).send({ ok: true, jobId: job.id, status: job.status });
});

server.get('/dev/reset/:id', async (request, reply) => {
  const resetToken = getHeader(request, 'x-reset-token');
  if (!RESET_TOKEN || resetToken !== RESET_TOKEN) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const requestIp = getRequestIp(request);
  if (!isResetIpAllowed(requestIp)) {
    return reply.status(403).send({ error: `Reset status not allowed from IP ${requestIp}` });
  }

  const id = (request.params as { id: string }).id;
  const job = resetJobs.get(id);
  if (!job) {
    return reply.status(404).send({ error: 'Reset job not found' });
  }
  return reply.send({ ok: true, job });
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

  const identityError = enforceDevIdentity(request, address);
  if (identityError) {
    return reply.status(403).send({ error: identityError });
  }

  const current = await getCurrentNonce(address);
  return reply.send({ ok: true, current, next: current + 1 });
});

server.post('/remittance/send', async (request, reply) => {
  if (!requireApiKey(request)) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const idempotencyKey = getHeader(request, 'idempotency-key');
  const payload = request.body as RemittancePayload;

  if (!payload?.from || !payload?.to || !payload?.amount || !payload?.assetId || !payload?.corridor) {
    return reply.status(400).send({ error: 'Missing required fields' });
  }

  const identityError = enforceDevIdentity(request, payload.from);
  if (identityError) {
    return reply.status(403).send({ error: identityError });
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
