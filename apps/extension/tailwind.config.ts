import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./sidepanel.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        sel: {
          bg: 'var(--sel-bg)',
          ring: 'var(--sel-ring)',
        },
        stage: {
          sourced: 'var(--stage-sourced)',
          screening: 'var(--stage-screening)',
          interviewing: 'var(--stage-interviewing)',
          offer: 'var(--stage-offer)',
          placed: 'var(--stage-placed)',
          rejected: 'var(--stage-rejected)',
        },
        ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', dot: 'var(--ok-dot)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', dot: 'var(--warn-dot)' },
      },
      borderRadius: {
        card: '12px',
        control: '8px',
        badge: '6px',
      },
      boxShadow: {
        token: '0 1px 2px rgba(0, 0, 0, 0.04)',
        pop: '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
