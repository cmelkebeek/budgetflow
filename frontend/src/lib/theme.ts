import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'theme';
const dark = matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

// « system » retire l'attribut : le CSS suit alors prefers-color-scheme.
export function setTheme(theme: Theme) {
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
