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
  checkins: {
    byDate: (date: string) => ['checkins', date] as const,
    range: (start: string, end: string) => ['checkins', 'range', start, end] as const,
  },
  habits: {
    all: ['habits'] as const,
    detail: (habitId: string) => ['habits', 'detail', habitId] as const,
    completions: (habitId: string, date: string) =>
      ['habits', 'completions', habitId, date] as const,
    allCompletions: (start: string, end: string) =>
      ['habits', 'all-completions', start, end] as const,
  },
  journal: {
    all: ['journal'] as const,
    range: (start: string, end: string) => ['journal', start, end] as const,
  },
  focusSessions: {
    all: ['focus-sessions'] as const,
  },
  admin: {
    users: ['admin', 'users'] as const,
    allowlist: ['admin', 'allowlist'] as const,
    auditLog: ['admin', 'audit-log'] as const,
  },
};
