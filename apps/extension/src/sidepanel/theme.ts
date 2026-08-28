import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const hasStorage = () => typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);

/** Same contract as the web app's useTheme: `dark` class on <html>, saved
 *  choice wins over the system preference. The panel is its own origin so
 *  the choice lives in chrome.storage rather than localStorage. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  useEffect(() => {
    if (!hasStorage()) return;
    chrome.storage.local.get(['theme'], (result) => {
      if (result?.theme === 'dark' || result?.theme === 'light') setTheme(result.theme);
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      if (hasStorage()) chrome.storage.local.set({ theme: next });
      return next;
    });
  }

  return [theme, toggleTheme];
}
