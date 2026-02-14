import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'remit_session';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

type SessionPayload = {
  address: string;
  exp: number;
};

function getSecret() {
  return process.env.SESSION_SECRET ?? '';
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function signSession(address: string, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  const secret = getSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: SessionPayload = { address, exp };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token: string) {
  const secret = getSecret();
  if (!secret) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const isValid =
    sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload.address || !payload.exp) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
