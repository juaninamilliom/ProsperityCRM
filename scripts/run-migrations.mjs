import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import process from 'node:process';
import { Client } from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../infra/db/migrations');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString: databaseUrl, ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  await client.connect();

  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf-8');
      console.log(`Running migration ${file}`);
      await client.query(sql);
    }
    console.log('✅ Migrations applied');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
