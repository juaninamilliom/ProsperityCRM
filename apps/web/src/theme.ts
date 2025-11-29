import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme(): [Theme, () => void] {
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [theme, setTheme] = useState<Theme>(() => (prefersDark ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }

  return [theme, toggleTheme];
}
