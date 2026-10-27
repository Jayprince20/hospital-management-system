'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from 'react';
import { useLanguage } from '@/context/language-context';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_EVENT = 'hms-theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Theme preference lives in localStorage; reading it through useSyncExternalStore keeps
// every component (and other tabs) in sync without setState-in-effect hydration.
function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_EVENT, onChange);
  media.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_EVENT, onChange);
    media.removeEventListener('change', onChange);
  };
}

function readTheme(): Theme {
  const stored = localStorage.getItem('theme');
  return stored === 'dark' || stored === 'system' ? stored : 'light';
}

function readSystemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

const subscribeNothing = () => () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light' as Theme);
  const systemDark = useSyncExternalStore(subscribeTheme, readSystemDark, () => false);
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Apply the resolved theme to the document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Theme toggle button component
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors ${className}`}
      title={resolvedTheme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      aria-label={resolvedTheme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
    >
      {resolvedTheme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

// Theme selector dropdown component
export function ThemeSelector({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${className}`}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
