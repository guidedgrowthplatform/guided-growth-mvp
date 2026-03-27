export const queryKeys = {
  metrics: {
    all: ['metrics'] as const,
  },
  entries: {
    all: ['entries'] as const,
    range: (start: string, end: string) => ['entries', start, end] as const,
  },
  preferences: {
    all: ['preferences'] as const,
  },
  reflections: {
    config: ['reflections', 'config'] as const,
    range: (start: string, end: string) => ['reflections', start, end] as const,
    affirmation: ['reflections', 'affirmation'] as const,
  },
  onboarding: {
    state: ['onboarding'] as const,
  },
  admin: {
    users: ['admin', 'users'] as const,
    allowlist: ['admin', 'allowlist'] as const,
    auditLog: ['admin', 'audit-log'] as const,
  },
};
