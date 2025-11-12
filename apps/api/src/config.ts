import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

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

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  oauthJwksUrl: process.env.OAUTH_JWKS_URL ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  rootAdminToken: process.env.ROOT_ADMIN_TOKEN ?? '',
  localAuthSecret: process.env.LOCAL_AUTH_SECRET ?? '',
};
