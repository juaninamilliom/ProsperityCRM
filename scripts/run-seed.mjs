import { readFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import process from 'node:process';
import { Client } from 'pg';
import 'dotenv/config';
import { seedTargetVerdict } from './seed-guard.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const seedFile = path.join(__dirname, '../infra/db/seed.sql');

function refusal(verdict) {
  switch (verdict.reason) {
    case 'no_url':
      return 'DATABASE_URL must be set.';
    case 'unparseable':
      return 'DATABASE_URL is not a connection string this guard can read a host from. Refusing to seed.';
    default:
      return [
        `Refusing to seed ${verdict.host}.`,
        '',
        'seed.sql truncates the BD and pipeline tables and deletes people and',
        'companies. There is no rollback. Only local databases are seeded without',
        'an explicit override.',
        '',
        'If you really mean to wipe that host, name it:',
        `  SEED_ALLOW_HOST=${verdict.host} npm run seed`,
      ].join('\n');
  }
}

async function main() {
  // Before the client is constructed, let alone connected.
  const verdict = seedTargetVerdict(process.env.DATABASE_URL, process.env.SEED_ALLOW_HOST);
  if (!verdict.allowed) {
    console.error(refusal(verdict));
    process.exit(1);
  }

  console.log(`Seeding ${verdict.host} — this truncates the BD and pipeline tables.`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
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
