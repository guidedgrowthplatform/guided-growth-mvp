import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'mvp03_theme';
const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];

// Single listener ref — prevents duplicate listeners when switching in/out of 'system' mode
let _mediaListener: (() => void) | null = null;

function applyTheme(theme: Theme): void {
  if (_mediaListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', _mediaListener);
    _mediaListener = null;
  }

  if (theme === 'system') {
    const apply = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    };
    apply();
    _mediaListener = apply;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _mediaListener);
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  loadTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',

  setTheme: (theme: Theme) => {
    set({ theme });
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  },

  loadTheme: () => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    const theme = stored && VALID_THEMES.includes(stored) ? stored : 'system';
    set({ theme });
    applyTheme(theme);
  },
}));

// Auto-initialize on import (same pattern as voiceSettingsStore)
if (typeof window !== 'undefined') {
  useThemeStore.getState().loadTheme();
}
