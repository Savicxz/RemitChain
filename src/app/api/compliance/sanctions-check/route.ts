import { NextResponse } from 'next/server';
import { guardInternalRequest } from '@/lib/api-guards';
import {
  parseSanctionsCheckRequest,
  type SanctionsCheckResponse,
} from '@/lib/compliance-schemas';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const guard = await guardInternalRequest(request, 'compliance:sanctions');
  if (guard) {
    return guard;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseSanctionsCheckRequest(payload);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ error: parsed.error ?? 'Invalid payload' }, { status: 400 });
  }

  const response: SanctionsCheckResponse = {
    ok: true,
    input: parsed.data,
    result: {
      status: 'CLEAR',
      checkedAt: new Date().toISOString(),
      matches: [],
    },
    meta: { note: 'Stub response - integrate sanctions provider.' },
  };

  return NextResponse.json(response);
}
