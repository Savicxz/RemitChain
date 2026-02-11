import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const relayerUrl = process.env.RELAYER_URL;
  if (!relayerUrl) {
    return NextResponse.json({ error: 'Relayer not configured' }, { status: 501 });
  }

  try {
    const response = await fetch(`${relayerUrl}/remittance/status/${params.id}`, {
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to reach relayer' }, { status: 502 });
  }
}