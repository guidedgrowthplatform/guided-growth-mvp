function isNativeApp(): boolean {
  return 'Capacitor' in window;
}

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export async function checkMicPermission(): Promise<MicPermissionStatus> {
  try {
    if (navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as MicPermissionStatus;
    }
  } catch {
    // Permissions API not supported or 'microphone' not a valid PermissionName
  }
  return 'unknown';
}

export async function requestMicPermission(): Promise<boolean> {
  try {
    if (isNativeApp()) {
      // Native app — getUserMedia triggers OS permission dialog
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    const error = err as DOMException;

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return false;
    }

    if (error.name === 'NotFoundError') {
      return false;
    }

    return false;
  }
}

export async function ensureMicPermission(): Promise<boolean> {
  const status = await checkMicPermission();

  if (status === 'granted') return true;
  if (status === 'denied') return false;

  return requestMicPermission();
}
