export interface DeviceLapseState {
  lastSeenAt: Date;
  notifiedAt: Date | null;
}

// lapsed beyond the window AND not yet notified since the user was last active
export function isSessionExpiredEligible(
  s: DeviceLapseState,
  now: Date,
  windowMs: number,
): boolean {
  if (now.getTime() - s.lastSeenAt.getTime() < windowMs) return false;
  return s.notifiedAt === null || s.notifiedAt.getTime() < s.lastSeenAt.getTime();
}
