import 'dotenv/config';

const REQUIRED_VARS = ['DATABASE_URL', 'API_PORT', 'OAUTH_JWKS_URL', 'ROOT_ADMIN_TOKEN'];

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
};
