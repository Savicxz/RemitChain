import { SubstrateEvent } from '@subql/types';
import { Dispute, Remittance } from '../types';

// Event field order (override via SUBQUERY_EVENT_*_FIELDS in .env)
// RemittanceSent(remittanceId, sender, recipient, amount, assetId, corridor)
// CashOutRequested(remittanceId, agent, timeoutBlock)
// CashOutCompleted(remittanceId, agent)
// DisputeOpened(remittanceId, openedBy, disputeType, evidenceHash)

const REMITTANCE_SENT_FIELDS = parseFieldOrder('SUBQUERY_EVENT_REMITTANCE_SENT_FIELDS', [
  'remittanceId',
  'sender',
  'recipient',
  'amount',
  'assetId',
  'corridor',
]);
const CASHOUT_REQUESTED_FIELDS = parseFieldOrder('SUBQUERY_EVENT_CASHOUT_REQUESTED_FIELDS', [
  'remittanceId',
  'agent',
  'timeoutBlock',
]);
const CASHOUT_COMPLETED_FIELDS = parseFieldOrder('SUBQUERY_EVENT_CASHOUT_COMPLETED_FIELDS', [
  'remittanceId',
  'agent',
]);
const DISPUTE_OPENED_FIELDS = parseFieldOrder('SUBQUERY_EVENT_DISPUTE_OPENED_FIELDS', [
  'remittanceId',
  'openedBy',
  'disputeType',
  'evidenceHash',
]);

function parseFieldOrder(envKey: string, fallback: string[]) {
  const raw = process.env[envKey];
  if (!raw) {
    return fallback;
  }
  const fields = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return fields.length > 0 ? fields : fallback;
}

function mapEventData(event: SubstrateEvent, fields: string[]) {
  const data = event.event.data;
  const mapped: Record<string, string> = {};
  fields.forEach((field, index) => {
    const value = data[index];
    if (value !== undefined && value !== null) {
      mapped[field] = value.toString();
    }
  });
  return mapped;
}

function getEventId(event: SubstrateEvent) {
  return `${event.block.block.header.number.toString()}-${event.idx}`;
}

function getTxHash(event: SubstrateEvent) {
  const extrinsic = event.extrinsic as unknown as {
    hash?: { toString(): string };
    extrinsic?: { hash?: { toString(): string } };
  };
  const hash = extrinsic?.hash ?? extrinsic?.extrinsic?.hash;
  return hash ? hash.toString() : getEventId(event);
}

function getRemittanceId(event: SubstrateEvent, fallback?: string) {
  const data = event.event.data;
  const candidate = data[0]?.toString();
  return candidate ?? fallback ?? getTxHash(event);
}

function getBlockNumber(event: SubstrateEvent) {
  return BigInt(event.block.block.header.number.toString());
}

function getTimestamp(event: SubstrateEvent) {
  return event.block.timestamp ?? new Date();
}

function ensureRemittanceDefaults(remittance: Remittance) {
  if (!remittance.sender) remittance.sender = 'unknown';
  if (!remittance.recipient) remittance.recipient = 'unknown';
  if (!remittance.amount) remittance.amount = BigInt(0);
  if (!remittance.assetId) remittance.assetId = 'UNKNOWN';
  if (!remittance.corridor) remittance.corridor = 'UNKNOWN';
  if (!remittance.status) remittance.status = 'UNKNOWN';
  if (!remittance.txHash) remittance.txHash = remittance.id;
  if (!remittance.blockNumber) remittance.blockNumber = BigInt(0);
  if (!remittance.timestamp) remittance.timestamp = new Date();
}

function createRemittance(id: string) {
  return new Remittance(
    id,
    'unknown',
    'unknown',
    BigInt(0),
    'UNKNOWN',
    'UNKNOWN',
    'UNKNOWN',
    id,
    BigInt(0),
    new Date()
  );
}

export async function handleRemittanceSent(event: SubstrateEvent): Promise<void> {
  const mapped = mapEventData(event, REMITTANCE_SENT_FIELDS);
  const remittanceId = mapped.remittanceId ?? getTxHash(event);
  const sender = mapped.sender ?? 'unknown';
  const recipient = mapped.recipient ?? 'unknown';
  const amount = BigInt(mapped.amount ?? '0');
  const assetId = mapped.assetId ?? 'UNKNOWN';
  const corridor = mapped.corridor ?? 'UNKNOWN';

  const remittance = new Remittance(
    remittanceId,
    sender,
    recipient,
    amount,
    assetId,
    corridor,
    'SENT',
    getTxHash(event),
    getBlockNumber(event),
    getTimestamp(event)
  );

  await remittance.save();
}

export async function handleCashOutRequested(event: SubstrateEvent): Promise<void> {
  const mapped = mapEventData(event, CASHOUT_REQUESTED_FIELDS);
  const remittanceId = mapped.remittanceId ?? getRemittanceId(event, getEventId(event));
  const agent = mapped.agent;

  const existing = await Remittance.get(remittanceId);
  const remittance = existing ?? createRemittance(remittanceId);
  ensureRemittanceDefaults(remittance);

  remittance.status = 'CASH_OUT_REQUESTED';
  if (agent) {
    remittance.cashOutAgent = agent;
  }
  remittance.txHash = getTxHash(event);
  remittance.blockNumber = getBlockNumber(event);
  remittance.timestamp = getTimestamp(event);

  await remittance.save();
}

export async function handleCashOutCompleted(event: SubstrateEvent): Promise<void> {
  const mapped = mapEventData(event, CASHOUT_COMPLETED_FIELDS);
  const remittanceId = mapped.remittanceId ?? getRemittanceId(event, getEventId(event));
  const agent = mapped.agent;

  const existing = await Remittance.get(remittanceId);
  const remittance = existing ?? createRemittance(remittanceId);
  ensureRemittanceDefaults(remittance);

  remittance.status = 'COMPLETED';
  if (agent) {
    remittance.cashOutAgent = agent;
  }
  remittance.completedAt = getTimestamp(event);
  remittance.txHash = getTxHash(event);
  remittance.blockNumber = getBlockNumber(event);
  remittance.timestamp = getTimestamp(event);

  await remittance.save();
}

export async function handleDisputeOpened(event: SubstrateEvent): Promise<void> {
  const mapped = mapEventData(event, DISPUTE_OPENED_FIELDS);
  const remittanceId = mapped.remittanceId ?? getRemittanceId(event, 'unknown');
  const openedBy = mapped.openedBy ?? 'unknown';
  const disputeType = mapped.disputeType ?? 'UNKNOWN';
  const evidenceHash = mapped.evidenceHash ?? 'UNKNOWN';

  const dispute = new Dispute(
    `${remittanceId}-${getEventId(event)}`,
    remittanceId,
    openedBy,
    disputeType,
    evidenceHash,
    getBlockNumber(event),
    'OPEN'
  );

  await dispute.save();
}
