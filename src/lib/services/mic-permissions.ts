/**
 * Microphone permissions utility for web and Capacitor (mobile).
 * Issue #24: Ensures mic permission is requested before starting voice input.
 * Issue #27: Fixes error logging and robust Capacitor handling.
 *
 * Strategy:
 * - Use navigator.mediaDevices.getUserMedia where available (web + Android Capacitor).
 * - Guard against undefined mediaDevices (iOS WKWebView with remote URL).
 * - Never crash — all errors are caught and return false gracefully.
 */

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Check current microphone permission status without prompting.
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  // Web Permissions API (Chrome, Edge, Firefox, Android WebView)
  try {
    if (navigator.permissions) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as MicPermissionStatus;
    }
  } catch {
    // 'microphone' not a valid PermissionName on this browser
  }
  return 'unknown';
}

/**
 * Request microphone permission. Returns true if granted, false if denied.
 * On first call, this triggers the browser/OS permission dialog.
 */
export async function requestMicPermission(): Promise<boolean> {
  try {
    // Guard: some WebViews (iOS WKWebView + remote URL) don't expose mediaDevices
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn(
        '[MicPermissions] mediaDevices API not available in this WebView.',
        'Voice input requires a browser with microphone support.'
      );
      return false;
    }

    console.log('[MicPermissions] Requesting mic via getUserMedia');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Got permission — immediately release the stream
    stream.getTracks().forEach((track) => track.stop());

    console.log('[MicPermissions] Microphone permission granted');
    return true;
  } catch (err) {
    // FIX #27: DOMException doesn't serialize to JSON (logs as {}).
    // Extract name + message for useful error logging.
    const error = err as DOMException;
    const errorInfo = { name: error?.name, message: error?.message, code: error?.code };

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.warn('[MicPermissions] Microphone permission denied by user:', errorInfo);
      return false;
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      console.warn('[MicPermissions] No microphone found on this device:', errorInfo);
      return false;
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      console.warn('[MicPermissions] Microphone is in use or not readable:', errorInfo);
      return false;
    }

    console.error('[MicPermissions] Unexpected error requesting mic:', errorInfo);
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
