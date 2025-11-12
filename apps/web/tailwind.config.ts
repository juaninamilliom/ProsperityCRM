import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          fuchsia: '#d946ef',
          green: '#22c55e',
          blue: '#2563eb',
        },
        surface: {
          light: '#ffffff',
          dark: '#0f172a',
        },
      },
      borderRadius: {
        card: '1.5rem',
      },
      boxShadow: {
        soft: '0 25px 45px rgba(15,23,42,0.12)',
        inner: 'inset 0 2px 6px rgba(15,23,42,0.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #d946ef 0%, #22c55e 45%, #2563eb 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
