import { NextResponse } from 'next/server';
import { getApi } from '@/lib/chain';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const api = await getApi();
    const block = await api.query.system.number();
    return NextResponse.json({ block: block.toNumber() });
  } catch {
    return NextResponse.json({ error: 'Chain unavailable' }, { status: 503 });
  }
}
