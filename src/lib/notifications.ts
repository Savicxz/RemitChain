import twilio from 'twilio';
import admin from 'firebase-admin';

function getFirebaseApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    return null;
  }

  try {
    const parsed = JSON.parse(serviceAccount);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });
  } catch {
    return null;
  }
}

export async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { ok: false, error: 'Twilio credentials missing' };
  }

  const client = twilio(sid, token);
  await client.messages.create({ to, from, body });
  return { ok: true };
}

export async function sendPush(token: string, title: string, body: string) {
  const app = getFirebaseApp();
  if (!app) {
    return { ok: false, error: 'Firebase credentials missing' };
  }

  await admin.messaging().send({
    token,
    notification: { title, body },
  });

  return { ok: true };
}

