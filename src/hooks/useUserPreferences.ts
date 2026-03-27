import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export interface UserPreferences {
  coachingStyle: string;
  voiceModel: string;
  language: string;
  morningTime: string;
  nightTime: string;
  pushNotifications: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  coachingStyle: 'friendly',
  voiceModel: 'alex',
  language: 'en-US',
  morningTime: '07:00',
  nightTime: '22:30',
  pushNotifications: true,
};

const SETTINGS_STORAGE_KEY = 'mvp03_page_settings';

function loadLocalPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_PREFERENCES;
}

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(loadLocalPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPreferences() {
      try {
        const { data, error: fetchError } = await supabase
          .from('user_preferences')
          .select('preferences_json')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setIsLoading(false);
          return;
        }

        if (data?.preferences_json) {
          const merged = { ...DEFAULT_PREFERENCES, ...data.preferences_json };
          setPreferences(merged);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preferences');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      const next = { ...preferences, [key]: value };
      setPreferences(next);

      // Save to localStorage as fallback
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }

      // Persist to Supabase
      if (!user) return;

      try {
        const { error: upsertError } = await supabase.from('user_preferences').upsert(
          {
            user_id: user.id,
            preferences_json: next,
          },
          { onConflict: 'user_id' },
        );

        if (upsertError) {
          setError(upsertError.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save preference');
      }
    },
    [preferences, user],
  );

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
  };
}
