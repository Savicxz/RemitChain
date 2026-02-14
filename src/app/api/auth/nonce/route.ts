import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getPrisma } from '@/lib/prisma';
import { buildLoginMessage, normalizeAddress } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const nonce = randomBytes(16).toString('hex');
  const issuedAt = new Date();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const key = normalizeAddress(address);

  await prisma.authNonce.upsert({
    where: { address: key },
    update: { nonce, issuedAt, expiresAt },
    create: { address: key, nonce, issuedAt, expiresAt },
  });

  const message = buildLoginMessage({ address, nonce, issuedAt, expiresAt });

  return NextResponse.json({
    nonce,
    message,
    expiresAt: expiresAt.toISOString(),
  });
}
