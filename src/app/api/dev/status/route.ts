import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const relayerUrl = process.env.RELAYER_URL;
  if (!relayerUrl) {
    return NextResponse.json({ error: 'Relayer not configured' }, { status: 501 });
  }

  try {
    const response = await fetch(`${relayerUrl}/dev/status`, {
      headers: {
        ...(process.env.RELAYER_API_KEY
          ? { 'x-relayer-api-key': process.env.RELAYER_API_KEY }
          : {}),
      },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: (body as { error?: string }).error ?? 'Failed to fetch status' },
        { status: response.status }
      );
    }

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: 'Failed to reach relayer' }, { status: 502 });
  }
}
