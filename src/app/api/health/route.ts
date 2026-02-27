import { NextResponse } from 'next/server';
import { getApi } from '@/lib/chain';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET() {
  const response: {
    ok: boolean;
    service: string;
    time: string;
    chain: { ok: boolean; endpoint: string; block?: number; error?: string };
    relayer: { ok: boolean; url: string | null; status?: number; error?: string; data?: unknown };
    redis: { ok: boolean; configured: boolean; error?: string; result?: unknown };
  } = {
    ok: true,
    service: 'web',
    time: new Date().toISOString(),
    chain: {
      ok: false,
      endpoint: process.env.CHAIN_WS_URL ?? 'wss://rpc.polkadot.io',
    },
    relayer: {
      ok: false,
      url: process.env.RELAYER_URL ?? null,
    },
    redis: {
      ok: false,
      configured: false,
    },
  };

  try {
    const api = await getApi();
    const block = await api.query.system.number();
    response.chain.ok = true;
    response.chain.block = Number(block.toString());
  } catch (error) {
    response.ok = false;
    response.chain.error = (error as Error).message;
  }

  const redis = getRedis();
  if (redis) {
    response.redis.configured = true;
    try {
      const ping = typeof redis.ping === 'function' ? await redis.ping() : 'ok';
      response.redis.ok = true;
      response.redis.result = ping;
    } catch (error) {
      response.ok = false;
      response.redis.ok = false;
      response.redis.error = (error as Error).message;
    }
  }

  const relayerUrl = process.env.RELAYER_URL;
  if (relayerUrl) {
    try {
      const healthResponse = await fetch(`${relayerUrl}/health`, {
        headers: {
          ...(process.env.RELAYER_API_KEY
            ? { 'x-relayer-api-key': process.env.RELAYER_API_KEY }
            : {}),
        },
      });
      response.relayer.ok = healthResponse.ok;
      response.relayer.status = healthResponse.status;
      response.relayer.data = await healthResponse.json().catch(() => null);
      if (!healthResponse.ok) {
        response.ok = false;
      }
    } catch (error) {
      response.ok = false;
      response.relayer.error = (error as Error).message;
    }
  }

  return NextResponse.json(response, { status: response.ok ? 200 : 503 });
}
