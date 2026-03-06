/**
 * Haptic feedback utility for web and mobile.
 * Issue #15: Haptic feedback on mobile when command is recognized.
 *
 * Uses Web Vibration API which works on:
 * - Android Chrome ✅
 * - Capacitor WebView (Android) ✅
 * - iOS Safari ❌ (no vibration API — silent no-op)
 * - Desktop ❌ (no vibration — silent no-op)
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const VIBRATION_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [15, 50, 15],        // double-tap
  error: [50, 30, 50, 30, 50],  // triple-buzz
};

/**
 * Trigger haptic feedback via Web Vibration API.
 * Silent no-op on unsupported browsers.
 */
export function haptic(style: HapticStyle = 'medium'): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(VIBRATION_PATTERNS[style]);
    }
  } catch {
    // Silently fail — haptics are nice-to-have
  }
}
