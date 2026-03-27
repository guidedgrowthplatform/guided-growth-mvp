/**
 * Microphone permissions utility for web and Capacitor (mobile).
 * Issue #24: Ensures mic permission is requested before starting voice input.
 *
 * - On web: uses navigator.mediaDevices.getUserMedia
 * - On Capacitor/mobile: uses Capacitor Permissions API if available
 */

/** Check if running inside a Capacitor native container */
function isNativeApp(): boolean {
  return 'Capacitor' in window;
}

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Check current microphone permission status without prompting.
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  try {
    // Try the Permissions API (Chrome, Edge)
    if (navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as MicPermissionStatus;
    }
  } catch {
    // Permissions API not supported or 'microphone' not a valid PermissionName
  }
  return 'unknown';
}

/**
 * Request microphone permission. Returns true if granted, false if denied.
 * On first call, this triggers the browser/OS permission dialog.
 */
export async function requestMicPermission(): Promise<boolean> {
  try {
    // On Capacitor native apps, try to access microphone which triggers OS permission dialog
    if (isNativeApp()) {
      console.log('[MicPermissions] Native app detected, requesting mic via getUserMedia');
    }

    // Request mic access — this triggers the permission prompt on both web and Capacitor
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Got permission — immediately stop the stream (we just wanted the permission)
    stream.getTracks().forEach((track) => track.stop());

    console.log('[MicPermissions] Microphone permission granted');
    return true;
  } catch (err) {
    const error = err as DOMException;

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.warn('[MicPermissions] Microphone permission denied by user');
      return false;
    }

    if (error.name === 'NotFoundError') {
      console.warn('[MicPermissions] No microphone found on this device');
      return false;
    }

    console.error('[MicPermissions] Unexpected error requesting mic:', error);
    return false;
  }
}

/**
 * Convenience function: check + request if needed.
 * Returns true if mic is usable, false if denied or unavailable.
 */
export async function ensureMicPermission(): Promise<boolean> {
  const status = await checkMicPermission();

  if (status === 'granted') return true;
  if (status === 'denied') return false;

  // Status is 'prompt' or 'unknown' — need to ask
  return requestMicPermission();
}
