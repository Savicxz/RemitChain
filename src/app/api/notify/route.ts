import { NextResponse } from 'next/server';
import { sendPush, sendSms } from '@/lib/notifications';
import { guardInternalRequest } from '@/lib/api-guards';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const guard = await guardInternalRequest(request, 'notify');
  if (guard) {
    return guard;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type } = payload as { type?: string };

  if (type === 'sms') {
    const { to, message } = payload as { to?: string; message?: string };
    if (!to || !message) {
      return NextResponse.json({ error: 'Missing SMS fields' }, { status: 400 });
    }
    const result = await sendSms(to, message);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 501 });
    }
    return NextResponse.json({ ok: true });
  }

  if (type === 'push') {
    const { token, title, message } = payload as {
      token?: string;
      title?: string;
      message?: string;
    };
    if (!token || !title || !message) {
      return NextResponse.json({ error: 'Missing push fields' }, { status: 400 });
    }
    const result = await sendPush(token, title, message);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 501 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported notification type' }, { status: 400 });
}
