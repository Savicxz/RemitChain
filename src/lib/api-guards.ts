import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';

export function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export function requireInternalApiKey(request: Request) {
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey) {
    return null;
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function guardInternalRequest(request: Request, rateKey: string) {
  const auth = requireInternalApiKey(request);
  if (auth) {
    return auth;
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(`${rateKey}:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  return null;
}
