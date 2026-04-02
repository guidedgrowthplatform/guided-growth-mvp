import { Capacitor } from '@capacitor/core';
import { Sentry } from '@/lib/sentry';
import { supabase, sessionReady } from '@/lib/supabase';

const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (Capacitor.isNativePlatform()) {
    console.error('[API] VITE_API_URL is not set on native platform — API calls will fail');
  }
  return '';
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiUrl()}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // On native, wait for session to be restored from Capacitor Preferences
  if (Capacitor.isNativePlatform()) {
    await sessionReady;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Continue without auth if session unavailable
  }

  const response = await fetch(url, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    const apiError = new ApiError(body.error || `HTTP ${response.status}`, response.status, body);
    Sentry.addBreadcrumb({
      category: 'api',
      message: `${options.method || 'GET'} ${endpoint} → ${response.status}`,
      level: response.status >= 500 ? 'error' : 'warning',
      data: { status: response.status, body },
    });
    throw apiError;
  }

  return response.json();
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint);
}

export function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(endpoint: string, body: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' });
}
