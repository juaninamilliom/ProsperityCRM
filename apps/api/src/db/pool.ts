import { Pool } from 'pg';
import { config } from '../config.js';

if (!config.databaseUrl) {
  console.warn('[db] DATABASE_URL not set. API routes will fail without a DB connection.');
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export type DBClient = Pool;
