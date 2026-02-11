import { NextResponse } from 'next/server';
import { guardInternalRequest } from '@/lib/api-guards';
import type { SarReportsResponse } from '@/lib/compliance-schemas';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await guardInternalRequest(request, 'compliance:sar');
  if (guard) {
    return guard;
  }

  const response: SarReportsResponse = {
    ok: true,
    data: [],
    meta: { note: 'Stub response - integrate compliance provider.' },
  };

  return NextResponse.json(response);
}
