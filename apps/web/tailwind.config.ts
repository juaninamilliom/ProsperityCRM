import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          surface: '#eef2ff',
        },
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        card: '0 10px 15px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
