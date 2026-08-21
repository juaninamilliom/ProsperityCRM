import { readFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import process from 'node:process';
import { Client } from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const seedFile = path.join(__dirname, '../infra/db/seed.sql');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }

  const client = new Client({ connectionString: databaseUrl });
  client.on('notice', (notice) => console.log(notice.message));
  await client.connect();

  try {
    await client.query(await readFile(seedFile, 'utf-8'));
    console.log('✅ Seeded');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
