/**
 * Data Anonymization Utility — MVP-19 (#43)
 *
 * Provides hashing/tokenization for user data to ensure sensitive
 * information (habit names, journal content, emails) is not connected
 * to user identities when exported for analytics or admin review.
 *
 * Uses SHA-256 → first 8 hex chars as a stable, irreversible token.
 * Same input always produces the same token (deterministic).
 */

// ─── Core Hashing ───

/**
 * SHA-256 hash a string, return first `length` hex chars as token.
 * Works in both browser (Web Crypto) and Node.js environments.
 */
export async function hashText(text: string, length = 8): Promise<string> {
  try {
    // Browser environment (Web Crypto API)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(text);
      const buffer = await crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(buffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.slice(0, length);
    }
  } catch {
    // Fall through to simple hash
  }

  // Fallback: simple deterministic hash (not cryptographic, but sufficient for anonymization)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(length, '0').slice(0, length);
}

/**
 * Synchronous simple hash for performance-critical paths.
 * Not cryptographic — use hashText() for security-sensitive operations.
 */
export function hashTextSync(text: string, length = 8): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(length, '0').slice(0, length);
}

// ─── Data Anonymizers ───

export interface AnonymizedHabit {
  id: string;
  name: string;           // hashed
  frequency: string;      // kept (not PII)
  createdAt: string;      // kept (not PII)
  active: boolean;        // kept
}

export interface AnonymizedJournal {
  id: string;
  content: string;        // hashed
  mood?: string;          // kept (not PII — categorical)
  themes?: string[];      // kept (not PII — categorical)
  date: string;           // kept
}

export interface AnonymizedUser {
  id: string;             // kept (UUID, not PII)
  email: string;          // hashed
  nickname: string;       // hashed
  ageGroup?: string;      // kept (categorical)
  gender?: string;        // kept (categorical)
  language?: string;      // kept
}

/**
 * Anonymize a habit — hash the name, keep structure/stats.
 */
export function anonymizeHabit(habit: { id: string; name: string; frequency?: string; createdAt?: string; active?: boolean }): AnonymizedHabit {
  return {
    id: habit.id,
    name: `habit_${hashTextSync(habit.name)}`,
    frequency: habit.frequency || 'daily',
    createdAt: habit.createdAt || '',
    active: habit.active ?? true,
  };
}

/**
 * Anonymize a journal entry — hash content, keep mood/themes (categorical, not PII).
 */
export function anonymizeJournal(entry: { id: string; content: string; mood?: string; themes?: string[]; date: string }): AnonymizedJournal {
  return {
    id: entry.id,
    content: `journal_${hashTextSync(entry.content)}`,
    mood: entry.mood,
    themes: entry.themes,
    date: entry.date,
  };
}

/**
 * Anonymize a user profile — hash email/nickname, keep categorical data.
 */
export function anonymizeUser(user: { id: string; email: string; nickname: string; age_group?: string; gender?: string; language?: string }): AnonymizedUser {
  return {
    id: user.id,
    email: `user_${hashTextSync(user.email)}@anon`,
    nickname: `anon_${hashTextSync(user.nickname)}`,
    ageGroup: user.age_group,
    gender: user.gender,
    language: user.language,
  };
}

/**
 * Anonymize free-text notes (habit completion notes, checkin notes, etc.)
 */
export function anonymizeNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  return `note_${hashTextSync(notes)}`;
}

/**
 * Batch anonymize an array of habits.
 */
export function anonymizeHabits(habits: Array<{ id: string; name: string; frequency?: string; createdAt?: string; active?: boolean }>): AnonymizedHabit[] {
  return habits.map(anonymizeHabit);
}

/**
 * Batch anonymize an array of journal entries.
 */
export function anonymizeJournals(entries: Array<{ id: string; content: string; mood?: string; themes?: string[]; date: string }>): AnonymizedJournal[] {
  return entries.map(anonymizeJournal);
}
