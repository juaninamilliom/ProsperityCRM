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
    // Ensure tracking table exists
    await client.query(`
      create table if not exists schema_migrations (
        id serial primary key,
        name text not null unique,
        applied_at timestamptz not null default now()
      );
    `);

    const appliedResult = await client.query('select name from schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.name));

    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log('✅ All migrations up to date (0 pending)');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s)...`);

    for (const file of pending) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf-8');
      console.log(`Running migration ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('✅ All migrations applied successfully');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
