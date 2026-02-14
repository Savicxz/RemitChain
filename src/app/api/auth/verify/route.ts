import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPrisma } from '@/lib/prisma';
import { buildLoginMessage, normalizeAddress, verifyWalletSignature } from '@/lib/auth';
import { getSessionCookieName, signSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { address?: string; signature?: string }
    | null;
  if (!body?.address || !body.signature) {
    return NextResponse.json({ error: 'Address and signature are required' }, { status: 400 });
  }

  const address = body.address.trim();
  const key = normalizeAddress(address);
  const record = await prisma.authNonce.findUnique({ where: { address: key } });
  if (!record) {
    return NextResponse.json({ error: 'Login nonce not found' }, { status: 400 });
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.authNonce.delete({ where: { address: key } }).catch(() => null);
    return NextResponse.json({ error: 'Login nonce expired' }, { status: 400 });
  }

  const message = buildLoginMessage({
    address,
    nonce: record.nonce,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });

  const isValid = await verifyWalletSignature(address, body.signature, message);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  await prisma.authNonce.delete({ where: { address: key } }).catch(() => null);

  const user = await prisma.user.upsert({
    where: { walletAddress: key },
    update: {},
    create: { walletAddress: key },
  });

  let token: string;
  try {
    token = signSession(key);
  } catch {
    return NextResponse.json({ error: 'SESSION_SECRET not configured' }, { status: 500 });
  }
  const response = NextResponse.json({ address: key, kycTier: user.kycTier });
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  response.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });

  return response;
}
