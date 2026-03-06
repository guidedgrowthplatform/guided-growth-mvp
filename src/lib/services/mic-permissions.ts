/**
 * Microphone permissions utility for web and Capacitor (mobile).
 * Issue #24: Ensures mic permission is requested before starting voice input.
 * Issue #27: Fixes error logging and adds proper Capacitor native permissions.
 *
 * Strategy:
 * 1. On Capacitor native: try @capacitor/microphone plugin (if installed),
 *    falling back to getUserMedia for the OS permission dialog.
 * 2. On web: uses navigator.mediaDevices.getUserMedia directly.
 */

/** Check if running inside a Capacitor native container */
function isNativeApp(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.isNativePlatform?.() === true;
}

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Check current microphone permission status without prompting.
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  // Try Capacitor Permissions API first (native)
  if (isNativeApp()) {
    try {
      const { Capacitor } = window as any;
      const { Plugins } = Capacitor;
      // If @capacitor/microphone plugin is installed, use it
      if (Plugins?.Microphone) {
        const result = await Plugins.Microphone.checkPermissions();
        return result.microphone as MicPermissionStatus;
      }
    } catch {
      // Plugin not installed, fall through to web API
    }
  }

  // Web Permissions API (Chrome, Edge, Firefox)
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
    // On Capacitor native: try the plugin first for proper OS dialog
    if (isNativeApp()) {
      console.log('[MicPermissions] Native app detected');
      try {
        const { Capacitor } = window as any;
        const { Plugins } = Capacitor;
        if (Plugins?.Microphone) {
          console.log('[MicPermissions] Using @capacitor/microphone plugin');
          const result = await Plugins.Microphone.requestPermissions();
          if (result.microphone === 'granted') {
            console.log('[MicPermissions] Microphone permission granted via Capacitor plugin');
            return true;
          }
          console.warn('[MicPermissions] Capacitor plugin returned:', result.microphone);
          return false;
        }
      } catch {
        // Plugin not available, fall through to getUserMedia
        console.log('[MicPermissions] No Capacitor mic plugin, falling back to getUserMedia');
      }
    }

    // Web fallback: getUserMedia triggers the permission prompt
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
