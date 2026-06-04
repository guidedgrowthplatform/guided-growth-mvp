// Pure wipe decisions for the onboarding visible thread, extracted so the
// flag-gating is testable without mounting OnboardingVoiceProvider.

// Vapi cold start (onCallStart, first call-start of a session).
// Stable-chat ON preserves the continuous Direct-LLM thread across the round-trip.
export function shouldWipeOnColdStart(stableEnabled: boolean): boolean {
  return !stableEnabled;
}

// anonId resolve/change. Stable-chat ON: first resolve (null → id) must keep the
// hydrated thread; only a genuine user switch wipes (leak prevention).
export function shouldWipeOnAnonIdChange(
  stableEnabled: boolean,
  prev: string | null,
  next: string | null,
): boolean {
  if (!stableEnabled) return true;
  return !!prev && prev !== next;
}
