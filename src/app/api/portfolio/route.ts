import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ASSETS } from '@/lib/data';
import { getSessionCookieName, verifySession } from '@/lib/session';

export const runtime = 'nodejs';

type SubqueryRemittance = {
  id: string;
  sender: string;
  recipient: string;
  amount: string;
  assetId: string;
  corridor: string;
  status: string;
  timestamp: string;
  txHash?: string;
};

function isMissingRemittancesFieldError(value: string) {
  const normalized = value.replace(/\\"/g, '"');
  return (
    normalized.includes('Cannot query field "remittances"') ||
    (normalized.includes('Cannot query field') &&
      normalized.toLowerCase().includes('remittances'))
  );
}

function extractGraphqlMessages(payload: string) {
  try {
    const parsed = JSON.parse(payload) as {
      errors?: Array<{ message?: string }>;
    };
    if (!Array.isArray(parsed.errors)) {
      return [];
    }
    return parsed.errors
      .map((entry) => entry?.message)
      .filter((message): message is string => Boolean(message));
  } catch {
    return [];
  }
}

function toNumber(amount: string, decimals: number) {
  try {
    const raw = BigInt(amount);
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const fracStr = decimals > 0 ? frac.toString().padStart(decimals, '0') : '';
    const value = Number(`${whole}${decimals > 0 ? `.${fracStr}` : ''}`);
    if (Number.isFinite(value)) {
      return value;
    }
  } catch {
    // ignore parse errors
  }
  return 0;
}

export async function GET() {
  const token = cookies().get(getSessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifySession(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const endpoint = process.env.SUBQUERY_GRAPHQL_URL ?? 'http://localhost:3001';
  const query = `
    query ($address: String!, $limit: Int!) {
      remittances(
        first: $limit
        orderBy: TIMESTAMP_DESC
        filter: {
          or: [
            { sender: { equalTo: $address } }
            { recipient: { equalTo: $address } }
          ]
        }
      ) {
        nodes {
          id
          sender
          recipient
          amount
          assetId
          corridor
          status
          timestamp
          txHash
        }
      }
    }
  `;

  let remittances: SubqueryRemittance[] = [];
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { address: payload.address, limit: 50 },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const details = await response.text();
      const messages = extractGraphqlMessages(details);
      if (
        isMissingRemittancesFieldError(details) ||
        messages.some((message) => isMissingRemittancesFieldError(message))
      ) {
        remittances = [];
      } else {
        return NextResponse.json(
          { error: 'Failed to reach SubQuery', details },
          { status: 502 }
        );
      }
    } else {
      const data = (await response.json()) as {
        data?: { remittances?: { nodes?: SubqueryRemittance[] } };
        errors?: Array<{ message: string }>;
      };
      if (data.errors?.length) {
        const firstError = data.errors[0].message ?? 'Unknown GraphQL error';
        if (
          isMissingRemittancesFieldError(firstError) ||
          data.errors.some((entry) => isMissingRemittancesFieldError(entry.message ?? ''))
        ) {
          remittances = [];
        } else {
          return NextResponse.json({ error: firstError }, { status: 502 });
        }
      } else {
        remittances = data.data?.remittances?.nodes ?? [];
      }
    }
  } catch {
    return NextResponse.json({ error: 'Failed to query SubQuery' }, { status: 502 });
  }

  const assetDecimals = ASSETS.reduce((acc, asset) => {
    acc[asset.id] = asset.decimals;
    return acc;
  }, {} as Record<string, number>);

  const balances = ASSETS.reduce((acc, asset) => {
    acc[asset.id] = 0;
    return acc;
  }, {} as Record<string, number>);

  const transactions = remittances.map((remittance) => {
    const decimals = assetDecimals[remittance.assetId] ?? 2;
    const amountValue = toNumber(remittance.amount, decimals);
    const isSender = remittance.sender === payload.address;
    const signed = `${isSender ? '-' : '+'}${amountValue.toFixed(decimals)}`;
    const counterparty = isSender ? remittance.recipient : remittance.sender;
    const method = isSender ? `Sent ${remittance.corridor}` : `Received ${remittance.corridor}`;

    if (balances[remittance.assetId] !== undefined) {
      balances[remittance.assetId] += isSender ? -amountValue : amountValue;
    }

    return {
      id: remittance.id,
      name: counterparty,
      method,
      amount: signed,
      currency: remittance.assetId,
      status: remittance.status,
      time: new Date(remittance.timestamp).toLocaleString(),
    };
  });

  return NextResponse.json({ balances, transactions });
}
