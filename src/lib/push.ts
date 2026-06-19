import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging, Importance, Visibility } from '@capacitor-firebase/messaging';
import { registerDeviceToken } from '@/api/notifications';
import { useAuthStore } from '@/stores/authStore';
import type { DevicePlatform } from '@gg/shared/types';
import { ANDROID_REMINDER_CHANNEL_ID } from '@gg/shared';

const ANDROID_CHANNEL_ID = ANDROID_REMINDER_CHANNEL_ID;

export async function ensureNotificationChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await FirebaseMessaging.createChannel({
      id: ANDROID_CHANNEL_ID,
      name: 'Reminders',
      description: 'Daily check-in and reflection reminders',
      importance: Importance.High,
      visibility: Visibility.Private,
    });
  } catch (err) {
    console.warn('[push] channel creation failed', err);
  }
}

// token refresh can fire before the Supabase session exists (register-token
// is auth-gated) — buffer here, flushed by flushPendingToken() once authed
let pendingToken: string | null = null;

// FCM is Android-only; iOS drops @capacitor-firebase/messaging (no plist → launch crash)
export function isPushSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

function devicePlatform(): DevicePlatform {
  return Capacitor.getPlatform() as DevicePlatform;
}

async function sendToken(token: string): Promise<void> {
  if (!useAuthStore.getState().anonId) {
    pendingToken = token;
    return;
  }
  try {
    await registerDeviceToken(token, devicePlatform());
    pendingToken = null;
  } catch (err) {
    console.warn('[push] token registration failed', err);
    pendingToken = token;
  }
}

export async function flushPendingToken(): Promise<void> {
  if (pendingToken) await sendToken(pendingToken);
}

export async function requestPushPermissionAndRegister(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') return false;
    const { token } = await FirebaseMessaging.getToken();
    await sendToken(token);
    return true;
  } catch (err) {
    // builds without Firebase config (or simulators) — never break the page
    console.warn('[push] permission/registration failed', err);
    return false;
  }
}

// silent re-register on app start: token rotation, reinstalls, account switches
export async function registerIfGranted(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== 'granted') return;
    const { token } = await FirebaseMessaging.getToken();
    await sendToken(token);
  } catch (err) {
    console.warn('[push] silent re-register failed', err);
  }
}

export function addPushListeners(
  onNavigate: (route: string) => void,
  onRefresh: () => void,
): () => void {
  if (!isPushSupported()) return () => {};

  const tokenListener = FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    void sendToken(token);
  });

  const receivedListener = FirebaseMessaging.addListener('notificationReceived', () => {
    onRefresh();
  });

  const tapListener = FirebaseMessaging.addListener(
    'notificationActionPerformed',
    ({ notification }) => {
      onRefresh();
      const data = notification.data as Record<string, string> | undefined;
      onNavigate(data?.route ?? '/notifications');
    },
  );

  return () => {
    void tokenListener.then((l) => l.remove());
    void receivedListener.then((l) => l.remove());
    void tapListener.then((l) => l.remove());
  };
}
