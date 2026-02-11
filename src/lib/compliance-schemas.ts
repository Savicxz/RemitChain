export type ComplianceStatus = 'CLEAR' | 'REVIEW' | 'FLAGGED';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type SarReportStatus = 'OPEN' | 'FILED' | 'CLOSED';

export type FlaggedAccount = {
  id: string;
  walletAddress: string;
  reason: string;
  severity: Severity;
  flaggedAt: string;
};

export type FlaggedAccountsResponse = {
  ok: true;
  data: FlaggedAccount[];
  meta?: { note?: string };
};

export type SarReport = {
  id: string;
  walletAddress: string;
  status: SarReportStatus;
  createdAt: string;
};

export type SarReportsResponse = {
  ok: true;
  data: SarReport[];
  meta?: { note?: string };
};

export type SanctionsCheckRequest = {
  walletAddress?: string;
  name?: string;
  country?: string;
  idNumber?: string;
};

export type SanctionsCheckResult = {
  status: ComplianceStatus;
  checkedAt: string;
  matches?: unknown[];
};

export type SanctionsCheckResponse = {
  ok: true;
  input: SanctionsCheckRequest;
  result: SanctionsCheckResult;
  meta?: { note?: string };
};

function readOptionalString(
  payload: Record<string, unknown>,
  key: keyof SanctionsCheckRequest,
  out: SanctionsCheckRequest
) {
  if (!(key in payload)) {
    return null;
  }

  const value = payload[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `Field "${key}" must be a non-empty string`;
  }

  out[key] = value.trim();
  return null;
}

export function parseSanctionsCheckRequest(payload: unknown): {
  ok: boolean;
  data?: SanctionsCheckRequest;
  error?: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid JSON body' };
  }

  const record = payload as Record<string, unknown>;
  const data: SanctionsCheckRequest = {};

  const errors = [
    readOptionalString(record, 'walletAddress', data),
    readOptionalString(record, 'name', data),
    readOptionalString(record, 'country', data),
    readOptionalString(record, 'idNumber', data),
  ].filter(Boolean);

  if (errors.length > 0) {
    return { ok: false, error: errors[0] as string };
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'At least one identifier field is required' };
  }

  return { ok: true, data };
}
