// Pure, testable wipe decision for the onboarding visible thread.

// anonId resolve/change. First resolve (null → id) keeps the hydrated thread;
// only a genuine user switch (or logout) wipes — cross-user leak prevention.
export function shouldWipeOnAnonIdChange(prev: string | null, next: string | null): boolean {
  return !!prev && prev !== next;
}
