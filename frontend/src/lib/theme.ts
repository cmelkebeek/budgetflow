import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'theme';
const dark = matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

// Couleur de la barre du navigateur (Safari iOS…) : celle du fond de page (--page) du thème affiché.
const PAGE_COLOR = { light: '#f6f6f3', dark: '#0d0d0d' };

function syncThemeColor(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = PAGE_COLOR[theme === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : theme];
  }
}

syncThemeColor(getTheme());

// « system » retire l'attribut : le CSS suit alors prefers-color-scheme.
export function setTheme(theme: Theme) {
  syncThemeColor(theme);
  if (theme === 'system') {
    localStorage.removeItem(KEY);
    delete document.documentElement.dataset.theme;
  } else {
    localStorage.setItem(KEY, theme);
    document.documentElement.dataset.theme = theme;
  }
  window.dispatchEvent(new Event('themechange'));
}

export const resolvedTheme = (theme: Theme): 'light' | 'dark' =>
  theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme;

export function useTheme() {
  const [theme, setState] = useState(getTheme);
  const [, rerender] = useState(0);

  useEffect(() => {
    const onThemeChange = () => setState(getTheme());
    const onSystemChange = () => rerender((n) => n + 1);
    window.addEventListener('themechange', onThemeChange);
    dark.addEventListener('change', onSystemChange);
    return () => {
      window.removeEventListener('themechange', onThemeChange);
      dark.removeEventListener('change', onSystemChange);
    };
  }, []);

  return { theme, resolved: resolvedTheme(theme), setTheme };
}
