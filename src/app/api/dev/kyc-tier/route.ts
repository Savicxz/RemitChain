import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { normalizeAddress } from '@/lib/auth';
import { guardInternalRequest } from '@/lib/api-guards';

export const runtime = 'nodejs';

type DevKycPayload = {
  address?: string;
  kycTier?: number | string;
};

function parseKycTier(value: DevKycPayload['kycTier']) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(parsed) || parsed === undefined || parsed < 0 || parsed > 3) {
    return null;
  }
  return parsed;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    );
  }

  const guard = await guardInternalRequest(request, 'dev:kyc-tier');
  if (guard) {
    return guard;
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: DevKycPayload;
  try {
    body = (await request.json()) as DevKycPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const kycTier = parseKycTier(body.kycTier);
  if (kycTier === null) {
    return NextResponse.json({ error: 'kycTier must be an integer between 0 and 3' }, { status: 400 });
  }

  const walletAddress = normalizeAddress(address);
  const existing = await prisma.user.findUnique({
    where: { walletAddress },
    select: { id: true, kycTier: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { walletAddress },
        data: { kycTier },
      })
    : await prisma.user.create({
        data: { walletAddress, kycTier },
      });

  return NextResponse.json({
    ok: true,
    address: user.walletAddress,
    kycTier: user.kycTier,
    previousKycTier: existing?.kycTier ?? null,
  });
}
