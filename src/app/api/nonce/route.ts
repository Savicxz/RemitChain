import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const relayerUrl = process.env.RELAYER_URL;
  if (!relayerUrl) {
    return NextResponse.json({ error: 'Relayer not configured' }, { status: 501 });
  }

  try {
    const response = await fetch(`${relayerUrl}/nonce/${encodeURIComponent(address)}`, {
      headers: {
        ...(process.env.RELAYER_API_KEY ? { 'x-relayer-api-key': process.env.RELAYER_API_KEY } : {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: (errorBody as { error?: string })?.error ?? 'Relayer error' },
        { status: response.status }
      );
    }

    const data = (await response.json()) as { next?: number; current?: number };
    if (typeof data.next !== 'number') {
      return NextResponse.json({ error: 'Invalid nonce response' }, { status: 502 });
    }

    return NextResponse.json({ nonce: data.next, current: data.current ?? data.next - 1 });
  } catch {
    return NextResponse.json({ error: 'Failed to reach relayer' }, { status: 502 });
  }
}
