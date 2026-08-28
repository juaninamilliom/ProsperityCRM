import type { Config } from 'tailwindcss';
import webConfig from '../web/tailwind.config';

// The side panel is the web app in a 360px column: same tokens, type scale,
// radii and shadows. The theme is imported rather than copied so the two can
// never drift; only the content globs differ.
const config: Config = {
  content: ['./sidepanel.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: webConfig.theme,
  plugins: [],
};

export default config;
