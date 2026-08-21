import type { Config } from 'tailwindcss';

// Colour values live in src/styles/tokens.css. This file only names them.
// Tailwind cannot apply opacity modifiers to var() colours - never write
// `bg-accent/20`; add a dedicated token instead.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
        bd: {
          prospect: 'var(--bd-prospect)',
          contacted: 'var(--bd-contacted)',
          meeting: 'var(--bd-meeting)',
          proposal: 'var(--bd-proposal)',
          negotiation: 'var(--bd-negotiation)',
          signed: 'var(--bd-signed)',
          lost: 'var(--bd-lost)',
        },
        ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', dot: 'var(--ok-dot)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', dot: 'var(--warn-dot)' },
        off: { bg: 'var(--off-bg)', fg: 'var(--off-fg)', dot: 'var(--off-dot)' },
        tint: {
          'eng-bg': 'var(--tint-eng-bg)',
          'eng-fg': 'var(--tint-eng-fg)',
          'design-bg': 'var(--tint-design-bg)',
          'design-fg': 'var(--tint-design-fg)',
        },
      },
      // Tailwind's scale jumps 16px -> 20px. The artboards use 18px between
      // field groups and in table rows, so the half-step is declared here.
      // An undeclared step is silently dropped, which is invisible until you
      // look at a screenshot.
      spacing: {
        '4.5': '1.125rem',
      },
      borderRadius: {
        control: 'var(--r-control)',
        card: 'var(--r-card)',
        chip: 'var(--r-chip)',
      },
      boxShadow: {
        token: 'var(--shadow)',
        pop: 'var(--shadow-pop)',
        panel: 'var(--shadow-panel)',
      },
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['11px', '1.4'],
        xs: ['11.5px', '1.4'],
        sm: ['12.5px', '1.45'],
        base: ['13px', '1.45'],
        lg: ['15px', '1.35'],
        title: ['27px', '1.15'],
        display: ['30px', '1.1'],
      },
    },
  },
  plugins: [],
};

export default config;
