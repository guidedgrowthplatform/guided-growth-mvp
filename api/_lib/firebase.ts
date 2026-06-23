import { ANDROID_REMINDER_CHANNEL_ID } from '@gg/shared';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import pool from './db.js';

let messaging: Messaging | null = null;

export function getFcm(): Messaging | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  if (!messaging) {
    if (getApps().length === 0) {
      initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    messaging = getMessaging();
  }
  return messaging;
}

const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered']);

const FCM_BATCH_SIZE = 500;

export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushResult {
  delivered: boolean;
  deadTokens: string[];
}

export async function sendPush(tokens: string[], payload: PushPayload): Promise<PushResult> {
  const fcm = getFcm();
  if (!fcm || tokens.length === 0) return { delivered: false, deadTokens: [] };

  let delivered = false;
  const deadTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
    const response = await fcm.sendEachForMulticast({
      tokens: batch,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      apns: { payload: { aps: { sound: 'default' } } },
      android: {
        priority: 'high',
        notification: {
          channelId: ANDROID_REMINDER_CHANNEL_ID,
          priority: 'high',
          defaultSound: true,
        },
      },
    });

    delivered ||= response.successCount > 0;
    for (const [j, r] of response.responses.entries()) {
      if (r.error && DEAD_TOKEN_CODES.has(r.error.code)) deadTokens.push(batch[j]);
    }
  }

  return { delivered, deadTokens };
}

export async function pruneDeadTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await pool.query('DELETE FROM device_tokens WHERE token = ANY($1)', [tokens]);
}
