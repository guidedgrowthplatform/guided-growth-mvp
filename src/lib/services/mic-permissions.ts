/**
 * Microphone permissions utility for web and Capacitor (mobile).
 * Issue #24: Ensures mic permission is requested before starting voice input.
 * Issue #27: Fixes error logging and robust Capacitor handling.
 *
 * Strategy (waterfall):
 * 1. Native Capacitor → SpeechRecognition plugin (handles RECORD_AUDIO natively)
 * 2. Web → getUserMedia (Chrome, Edge, Safari, Firefox)
 * 3. Fallback → assume prompt/unknown, never crash
 *
 * Every code path is wrapped in try-catch. No exceptions escape.
 */

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

/** Safe detect if running inside native Capacitor shell */
function isNativePlatform(): boolean {
  try {
    // Dynamic import to avoid crash when Capacitor isn't installed
    const cap = (window as any)?.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') {
      return cap.isNativePlatform();
    }
  } catch {
    // Capacitor not loaded — we're on web
  }
  return false;
}

/** Safe access to the speech recognition plugin */
function getSpeechRecognitionPlugin(): any | null {
  try {
    // Try to access the registered Capacitor plugin
    const plugins = (window as any)?.Capacitor?.Plugins;
    if (plugins?.SpeechRecognition) {
      return plugins.SpeechRecognition;
    }
    // Also try the module-level import path
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return null;
  } catch {
    return null;
  }
}

// ─── Capacitor Native Permissions ───

async function checkNativePermission(): Promise<MicPermissionStatus> {
  try {
    const plugin = getSpeechRecognitionPlugin();
    if (!plugin) {
      console.warn('[MicPermissions] SpeechRecognition plugin not available, falling back to web');
      return checkWebPermission();
    }
    const result = await plugin.checkPermissions();
    const status = result?.speechRecognition;
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'prompt';
  } catch (err) {
    console.warn('[MicPermissions] Native permission check failed, falling back to web:', err);
    // Fallback to web check if native plugin fails
    return checkWebPermission();
  }
}

async function requestNativePermission(): Promise<boolean> {
  try {
    const plugin = getSpeechRecognitionPlugin();
    if (!plugin) {
      console.warn('[MicPermissions] SpeechRecognition plugin not registered, trying web fallback');
      return requestWebPermission();
    }
    console.log('[MicPermissions] Requesting native speech recognition permission');
    const result = await plugin.requestPermissions();
    const granted = result?.speechRecognition === 'granted';
    console.log('[MicPermissions] Native permission result:', result?.speechRecognition);
    if (granted) return true;

    // If native plugin denied, try web as fallback (some WebViews support getUserMedia)
    console.log('[MicPermissions] Native denied, trying getUserMedia fallback');
    return requestWebPermission();
  } catch (err) {
    console.warn('[MicPermissions] Native permission request failed, trying web fallback:', err);
    return requestWebPermission();
  }
}

// ─── Web Permissions ───

async function checkWebPermission(): Promise<MicPermissionStatus> {
  try {
    if (navigator?.permissions) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as MicPermissionStatus;
    }
  } catch {
    // 'microphone' not a valid PermissionName on this browser (Safari, Firefox)
  }

  // Can't check without prompting — check if getUserMedia is even available
  try {
    if (typeof navigator?.mediaDevices?.getUserMedia === 'function') {
      return 'unknown'; // Available but we don't know status
    }
  } catch {
    // mediaDevices not available
  }

  return 'unknown';
}

async function requestWebPermission(): Promise<boolean> {
  try {
    // Guard 1: Check if mediaDevices API exists
    if (typeof navigator === 'undefined') {
      console.warn('[MicPermissions] navigator not available (SSR?)');
      return false;
    }

    if (!navigator.mediaDevices) {
      console.warn('[MicPermissions] mediaDevices API not available.',
        'This may be iOS WKWebView with remote URL, or an older browser.');
      return false;
    }

    if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
      console.warn('[MicPermissions] getUserMedia not a function on this browser/WebView.');
      return false;
    }

    console.log('[MicPermissions] Requesting mic via getUserMedia');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Got permission — immediately release the stream to free mic
    if (stream && stream.getTracks) {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* ignore track stop errors */ }
      });
    }

    console.log('[MicPermissions] Microphone permission granted');
    return true;
  } catch (err) {
    // FIX #27: DOMException doesn't serialize to JSON (logs as {}).
    // Extract name + message for useful error logging.
    if (err instanceof DOMException || (err && typeof err === 'object' && 'name' in err)) {
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

      if (error.name === 'AbortError') {
        console.warn('[MicPermissions] getUserMedia aborted:', errorInfo);
        return false;
      }

      if (error.name === 'OverconstrainedError') {
        console.warn('[MicPermissions] Audio constraints not satisfiable:', errorInfo);
        return false;
      }

      console.error('[MicPermissions] Unexpected DOMException:', errorInfo);
    } else {
      // Non-DOMException error — could be TypeError, SecurityError etc
      console.error('[MicPermissions] Unexpected error:', err);
    }
    return false;
  }
}

// ─── Public API (never throws) ───

/**
 * Check current microphone permission status without prompting.
 * Always returns a valid MicPermissionStatus, never throws.
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  try {
    return isNativePlatform() ? await checkNativePermission() : await checkWebPermission();
  } catch (err) {
    console.error('[MicPermissions] Unexpected error in checkMicPermission:', err);
    return 'unknown';
  }
}

/**
 * Request microphone permission. Returns true if granted, false if denied.
 * Always returns a boolean, never throws.
 */
export async function requestMicPermission(): Promise<boolean> {
  try {
    return isNativePlatform() ? await requestNativePermission() : await requestWebPermission();
  } catch (err) {
    console.error('[MicPermissions] Unexpected error in requestMicPermission:', err);
    return false;
  }
}

/**
 * Convenience function: check + request if needed.
 * Returns true if mic is usable, false if denied or unavailable.
 * NEVER THROWS — all errors caught and return false.
 */
export async function ensureMicPermission(): Promise<boolean> {
  try {
    const status = await checkMicPermission();

    if (status === 'granted') return true;
    if (status === 'denied') return false;

    // Status is 'prompt' or 'unknown' — need to ask
    return await requestMicPermission();
  } catch (err) {
    console.error('[MicPermissions] Unexpected error in ensureMicPermission:', err);
    return false;
  }
}
