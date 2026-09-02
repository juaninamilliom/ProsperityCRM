import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { resolveAppBaseUrl } from './modules/auth/origin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = process.env.DOTENV_CONFIG_PATH ?? path.resolve(__dirname, '../../../.env');

if (fs.existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath });
} else {
  loadEnv();
}

const REQUIRED_VARS = ['DATABASE_URL', 'API_PORT', 'ROOT_ADMIN_TOKEN', 'LOCAL_AUTH_SECRET'];

REQUIRED_VARS.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[config] Missing env var ${key}. Set it in your .env file.`);
  }
});

const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);

export const config = {
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  oauthJwksUrl: process.env.OAUTH_JWKS_URL ?? '',
  corsOrigins,
  /** Where sign-in links point. Falls back to the first allowed origin so a
   *  fresh checkout works before APP_BASE_URL is set; a deployment must set
   *  one of the two, because this is what makes the link independent of the
   *  caller's Origin header. */
  appBaseUrl: resolveAppBaseUrl(process.env.APP_BASE_URL, corsOrigins),
  rootAdminToken: process.env.ROOT_ADMIN_TOKEN ?? '',
  localAuthSecret: process.env.LOCAL_AUTH_SECRET ?? '',
};
