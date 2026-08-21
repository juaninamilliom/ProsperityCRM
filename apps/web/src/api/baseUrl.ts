/** Where the web app looks for the API.
 *
 *  An explicit VITE_API_BASE_URL always wins. Without one, a production build
 *  must NOT fall back to localhost: that is what a deployed site does when
 *  nobody remembers to set the variable, and it fails in a way that looks
 *  exactly like the API being down. */
const DEPLOYED_API = 'https://prosperitycrm.onrender.com';

export function resolveBaseUrl(env: {
  VITE_API_BASE_URL?: string;
  PROD?: boolean;
}): string {
  const explicit = env.VITE_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return env.PROD ? DEPLOYED_API : 'http://localhost:4000';
}
