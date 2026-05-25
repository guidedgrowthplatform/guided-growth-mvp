export type AuthHandoffKind = 'email_confirmed' | 'password_reset';

const HANDOFF_STORAGE_KEY = 'auth_handoff_pending';

export function buildHandoffUrl(kind: AuthHandoffKind): string {
  const flag = kind === 'email_confirmed' ? 'confirmed=1' : 'reset=1';
  return `guidedgrowth://auth/handoff?${flag}`;
}

export function setPendingAuthHandoff(kind: AuthHandoffKind): void {
  try {
    sessionStorage.setItem(HANDOFF_STORAGE_KEY, kind);
  } catch {
    /* */
  }
}

export function consumePendingAuthHandoff(): AuthHandoffKind | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
    if (raw === 'email_confirmed' || raw === 'password_reset') return raw;
    return null;
  } catch {
    return null;
  }
}

const ERROR_STORAGE_KEY = 'auth_error_pending';

export function setPendingAuthError(message: string): void {
  try {
    sessionStorage.setItem(ERROR_STORAGE_KEY, message);
  } catch {
    /* */
  }
}

export function consumePendingAuthError(): string | null {
  try {
    const msg = sessionStorage.getItem(ERROR_STORAGE_KEY);
    if (msg) sessionStorage.removeItem(ERROR_STORAGE_KEY);
    return msg;
  } catch {
    return null;
  }
}
