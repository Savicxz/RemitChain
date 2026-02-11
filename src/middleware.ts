import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRateLimiter } from '@/lib/ratelimit';

export async function middleware(request: NextRequest) {
  const ratelimit = getRateLimiter();
  if (!ratelimit) {
    return NextResponse.next();
  }

  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const { success } = await ratelimit.limit(`remit:ip:${ip}`);

  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};

