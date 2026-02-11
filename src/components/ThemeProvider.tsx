'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_COOKIE_KEY = 'clout_theme';
const LEGACY_THEME_KEY = 'theme';

function getCookieValue(name: string): string {
  if (typeof document === 'undefined') return '';
  const cookies = String(document.cookie || '').split(';');
  let value = '';
  for (const part of cookies) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    if (k === name) value = rest.join('=');
  }
  return value;
}

function setThemeCookie(value: 'light' | 'dark' | null) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const host = window.location.hostname;
  const domain =
    host === 'clout.co.jp' || host.endsWith('.clout.co.jp')
      ? '; Domain=clout.co.jp'
      : '';

  if (!value) {
    // Clear both host-only and parent-domain cookies (if any).
    document.cookie = `${THEME_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    if (domain) {
      document.cookie = `${THEME_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domain}`;
    }
    return;
  }

  // Prefer a parent-domain cookie for cross-app persistence, and delete any host-only cookie to avoid duplicates.
  document.cookie = `${THEME_COOKIE_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}${domain}`;
  if (domain) {
    document.cookie = `${THEME_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Cross-app handoff: accept `?theme=` and keep URL clean (cookie is the SSoT).
    try {
      const url = new URL(window.location.href);
      const themeParam = String(url.searchParams.get('theme') || '').trim().toLowerCase();
      if (themeParam === 'light' || themeParam === 'dark') {
        setThemeCookie(themeParam);
        setThemeState(themeParam);
        url.searchParams.delete('theme');
        window.history.replaceState({}, '', url.toString());
        return;
      }

      if (themeParam) {
        url.searchParams.delete('theme');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // ignore
    }

    // Cookie is the single source of truth (cross-app). localStorage is legacy and migrated away.
    const cookieTheme = getCookieValue(THEME_COOKIE_KEY);
    if (cookieTheme === 'light' || cookieTheme === 'dark') {
      setThemeState(cookieTheme);
      return;
    }

    // Migration path: localStorage -> cookie (best-effort), then cleanup.
    try {
      const legacy = (localStorage.getItem(THEME_COOKIE_KEY) || localStorage.getItem(LEGACY_THEME_KEY)) as Theme | null;
      if (legacy === 'light' || legacy === 'dark') {
        setThemeCookie(legacy);
        setThemeState(legacy);
      } else {
        // 'system' or unknown -> represent as no cookie
        setThemeCookie(null);
        setThemeState('system');
      }
      localStorage.removeItem(THEME_COOKIE_KEY);
      localStorage.removeItem(LEGACY_THEME_KEY);
    } catch {
      // ignore migration failures
    }
  }, []);

  useEffect(() => {
    // テーマの適用
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
      // Legacy class cleanup (older GGCRM versions used `html.light-mode`).
      root.classList.remove('light-mode');
      setActualTheme(isDark ? 'dark' : 'light');
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (newTheme === 'system') {
      setThemeCookie(null);
      // Best-effort cleanup for legacy keys
      try {
        localStorage.removeItem(THEME_COOKIE_KEY);
        localStorage.removeItem(LEGACY_THEME_KEY);
      } catch {
        // ignore
      }
      return;
    }
    setThemeCookie(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// テーマ切り替えボタンコンポーネント
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'ライト' },
    { value: 'dark', icon: Moon, label: 'ダーク' },
    { value: 'system', icon: Monitor, label: 'システム' },
  ];

  return (
    <div className={`flex bg-muted dark:bg-gray-800 rounded-xl p-1 ${className}`}>
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            theme === value
              ? 'bg-white dark:bg-gray-700 text-foreground dark:text-white shadow-sm'
              : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'
          }`}
          title={label}
        >
          <Icon size={16} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// シンプルなトグルボタン
export function ThemeToggleSimple() {
  const { actualTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(actualTheme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-lg hover:bg-muted dark:hover:bg-gray-800 transition-colors"
      title={actualTheme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
    >
      {actualTheme === 'light' ? (
        <Moon size={20} className="text-muted-foreground" />
      ) : (
        <Sun size={20} className="text-yellow-500" />
      )}
    </button>
  );
}
