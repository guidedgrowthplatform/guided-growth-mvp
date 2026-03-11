/**
 * Microphone permissions utility for web and Capacitor (mobile).
 * Issue #24: Ensures mic permission is requested before starting voice input.
 * Issue #27: Fixes error logging and robust Capacitor handling.
 *
 * Strategy:
 * - On Capacitor native: use @capacitor-community/speech-recognition plugin
 *   which handles RECORD_AUDIO + SPEECH_RECOGNITION permissions natively.
 * - On web: use navigator.mediaDevices.getUserMedia (Chrome, Edge, Firefox).
 * - Never crash — all errors are caught and return false gracefully.
 */

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

/** Detect if we're running inside a native Capacitor app */
function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ─── Capacitor Native Permissions ───

async function checkNativePermission(): Promise<MicPermissionStatus> {
  try {
    const result = await SpeechRecognition.checkPermissions();
    const status = result.speechRecognition;
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'prompt';
  } catch (err) {
    console.warn('[MicPermissions] Native permission check failed:', err);
    return 'unknown';
  }
}

async function requestNativePermission(): Promise<boolean> {
  try {
    console.log('[MicPermissions] Requesting native speech recognition permission');
    const result = await SpeechRecognition.requestPermissions();
    const granted = result.speechRecognition === 'granted';
    console.log('[MicPermissions] Native permission result:', result.speechRecognition);
    return granted;
  } catch (err) {
    console.error('[MicPermissions] Native permission request failed:', err);
    return false;
  }
}

// ─── Web Permissions ───

async function checkWebPermission(): Promise<MicPermissionStatus> {
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

async function requestWebPermission(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('[MicPermissions] mediaDevices API not available.');
      return false;
    }

    console.log('[MicPermissions] Requesting mic via getUserMedia');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Got permission — immediately release the stream
    stream.getTracks().forEach((track) => track.stop());

    console.log('[MicPermissions] Microphone permission granted');
    return true;
  } catch (err) {
    const error = err as DOMException;
    const errorInfo = { name: error?.name, message: error?.message, code: error?.code };

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.warn('[MicPermissions] Microphone permission denied:', errorInfo);
      return false;
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      console.warn('[MicPermissions] No microphone found:', errorInfo);
      return false;
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      console.warn('[MicPermissions] Microphone in use or not readable:', errorInfo);
      return false;
    }

    console.error('[MicPermissions] Unexpected error:', errorInfo);
    return false;
  }
}

// ─── Public API ───

/**
 * Check current microphone permission status without prompting.
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  return isNative() ? checkNativePermission() : checkWebPermission();
}

/**
 * Request microphone permission. Returns true if granted, false if denied.
 */
export async function requestMicPermission(): Promise<boolean> {
  return isNative() ? requestNativePermission() : requestWebPermission();
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
