import { useThemeStore, type Theme } from '../stores/themeStore';

export function useTheme() {
  const { theme, setTheme } = useThemeStore();
  // Derive isDark from reactive state — never read DOM directly (would be stale after toggle)
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return { theme, setTheme, isDark };
}

export type { Theme };
