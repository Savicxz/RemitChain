import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { submitRemittancePlaceholder } from '@/lib/chain';
import { checkRateLimit } from '@/lib/ratelimit';
import { getPrisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const ipLimit = await checkRateLimit(`remit:ip:${ip}`);
  if (!ipLimit.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { from, to, amount, assetId, corridor, signature, nonce, deadline, chainId } = payload as {
    from?: string;
    to?: string;
    amount?: string;
    assetId?: string;
    corridor?: string;
    signature?: string;
    nonce?: number;
    deadline?: number;
    chainId?: string;
  };

  if (!from || !to || !amount || !assetId || !corridor) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const walletLimit = await checkRateLimit(`remit:wallet:${from}`);
  if (!walletLimit.success) {
    return NextResponse.json({ error: 'Wallet rate limit exceeded' }, { status: 429 });
  }

  const relayerUrl = process.env.RELAYER_URL;
  if (relayerUrl) {
    try {
      const idempotencyKey = request.headers.get('idempotency-key');
      const relayerResponse = await fetch(`${relayerUrl}/remittance/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...(process.env.RELAYER_API_KEY
            ? { 'x-relayer-api-key': process.env.RELAYER_API_KEY }
            : {}),
        },
        body: JSON.stringify({
          from,
          to,
          amount,
          assetId,
          corridor,
          signature,
          nonce,
          deadline,
          chainId,
        }),
      });

      if (!relayerResponse.ok) {
        const errorBody = await relayerResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: (errorBody as { error?: string })?.error ?? 'Relayer request failed' },
          { status: relayerResponse.status }
        );
      }

      const data = (await relayerResponse.json()) as {
        relayerId?: string;
        status?: string;
        txHash?: string;
      };

      await persistRemittance({
        from,
        to,
        amount,
        assetId,
        corridor,
        onChainId: data.relayerId ?? `relayer_${Date.now()}`,
        status: data.status ?? 'QUEUED',
        txHash: data.txHash,
      });

      return NextResponse.json({ ok: true, source: 'relayer', ...data });
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to reach relayer service' },
        { status: 502 }
      );
    }
  }

  const chainResult = await submitRemittancePlaceholder({
    from,
    to,
    amount,
    assetId,
    corridor,
    signature,
    nonce,
    deadline,
    chainId,
  });
  await persistRemittance({
    from,
    to,
    amount,
    assetId,
    corridor,
    onChainId: chainResult.hash ?? `chain_${Date.now()}`,
    status: chainResult.status ?? 'QUEUED',
    txHash: chainResult.hash,
  });

  return NextResponse.json({ ok: true, source: 'chain', ...chainResult });
}


async function persistRemittance(input: {
  from: string;
  to: string;
  amount: string;
  assetId: string;
  corridor: string;
  onChainId: string;
  status: string;
  txHash?: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  try {
    await prisma.remittance.upsert({
      where: { onChainId: input.onChainId },
      update: {
        status: input.status,
        txHash: input.txHash ?? undefined,
      },
      create: {
        onChainId: input.onChainId,
        sender: {
          connectOrCreate: {
            where: { walletAddress: input.from },
            create: { walletAddress: input.from },
          },
        },
        recipientWallet: input.to,
        amount: new Prisma.Decimal(input.amount),
        sourceAsset: input.assetId,
        destAsset: input.assetId,
        corridor: input.corridor,
        status: input.status,
        txHash: input.txHash ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to persist remittance', error);
  }
}
