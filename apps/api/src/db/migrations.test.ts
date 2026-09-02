import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanMigration } from './migration-guard.js';

/** Migrations run against every database this code is ever pointed at,
 *  production included, on every deploy from main — and the repository is
 *  public. They run once per database keyed by filename, inside a transaction,
 *  and there are no down migrations.
 *
 *  So the mistakes these guard against are invisible in a diff and permanent
 *  in a deploy. The scanner itself is tested against an adversarial corpus in
 *  migration-guard.test.ts; this file points it at the real tree and adds the
 *  rules that are about the directory rather than the SQL. */

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../infra/db/migrations',
);

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(path.join(migrationsDir, name), 'utf8') }));

/** Frozen on 2026-09-02. The runner skips any filename already recorded in
 *  schema_migrations, so editing an applied file changes nothing on production
 *  or on any developer machine — the edit is a silent no-op that looks like a
 *  fix. Adding a migration means adding its hash here, which is the deliberate
 *  act; changing one means flipping a hash in the same commit, which is how
 *  git history records that someone chose to do it. */
const FROZEN: Record<string, string> = {
  '0001_init.sql': '00b52426950ad03d46a4f68732bc5df8545230e30eb9302e97406d9e3f3af34d',
  '0002_seed_statuses.sql': '14193736095abc64be9560917e5480175b8f068b41dd641f4ac722aaedec8d13',
  '0003_add_organizations.sql': '42cd3ff390f5e4ee58f6dd391a33345b9822a9ce47dcc1d002fbfe64e0953b42',
  '0004_invite_codes.sql': '07d3eea06d3e739726bc2fc369d364099b6d64edbe5932a4ab85fc6220d17b0e',
  '0005_local_auth.sql': 'bb8c149b3fe536b4a8bf0b1850430fe864be3414eaa25f8a459033ba0bc1216d',
  '0006_job_requisitions.sql': 'f54bd95709605ae86dca0d83e1e68963995733b65678aec35afe6f1272db4585',
  '0007_job_deal_sheet.sql': 'ef11f365eaff4a7d7523cdcef2e002d8ead6f43b11af1cc95c334e80a5a198f9',
  '0008_candidate_skills.sql': '9743bc38b4ad31a4bd518151dbdf5a1a5a975fa3d3cc1de3fc73830280ac3333',
  '0009_organization_skills.sql': '6f5345c28a6a3ddc792468d8834c68536846ef693e6f4c760bf82305b067d923',
  '0010_bd_funnel_and_people.sql': '7e2129cc30d3d62bd30dcbbe6a21aac1b6f06eecae5f6f342a9cd49663500126',
  '0011_enable_rls_security.sql': '27d56f7b25583ae2f79e43af8a4f7f9b7c12829e542a056c8657ef8877dacdfd',
  '0013_fix_backend_permissions_and_policies.sql':
    'a32e8e31453ce20dcd52c0eee0ed939c947cd15f29adc51d37af1ca71f3268e4',
  '0014_passkeys_and_magic_links.sql':
    '5e5a71d2f5e86d914a714552a02106b7b1506be0ddc359bd408c6425f83e343f',
};

const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const numericPrefix = (name: string) => Number(name.slice(0, 4));

describe('migrations', () => {
  it('are found where the runner looks for them', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('carry no credentials and no grants to the PostgREST roles', () => {
    // A default account belongs in seed.sql, which a developer runs by hand
    // against a database they chose. A migration chooses for them. And
    // Supabase serves any table anon or authenticated can read over its REST
    // API, to anyone holding the project's public key.
    const offenders = migrations
      .map(({ name, sql }) => ({ name, violations: scanMigration(sql) }))
      .filter(({ violations }) => violations.length > 0);
    expect(offenders).toEqual([]);
  });

  it('are named NNNN_snake_case.sql', () => {
    // Four digits, because the runner sorts lexicographically: a five-digit
    // prefix would sort before 0001 and run first.
    const misnamed = migrations.map((m) => m.name).filter((n) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(n));
    expect(misnamed).toEqual([]);
  });

  it('never reuse the number 0012', () => {
    // 0012 wrote two OrgAdmin accounts with the password "password" into
    // whatever database the runner was pointed at, production included, from
    // a public repository. It was deleted, but every database that ran it
    // still carries its schema_migrations row, so the number can never be
    // used again — a new 0012 would be skipped in exactly the places that
    // most need it.
    expect(migrations.map((m) => m.name).filter((n) => n.startsWith('0012'))).toEqual([]);
  });

  it('sort the same way lexicographically and numerically', () => {
    const names = migrations.map((m) => m.name);
    const byNumber = [...names].sort((a, b) => numericPrefix(a) - numericPrefix(b));
    expect(names).toEqual(byNumber);
  });

  it('give every migration a distinct number', () => {
    const numbers = migrations.map((m) => numericPrefix(m.name));
    expect(numbers).toEqual([...new Set(numbers)]);
  });

  it('enable row level security on every table they create', () => {
    // The policy this pairs with is USING (true) WITH CHECK (true). It exists
    // to stop PostgREST exposure; it isolates nothing between tenants and must
    // not be described as if it did. 0013 loops over pg_tables as they existed
    // at that moment, so a table added afterwards has to say so itself.
    const all = migrations.map((m) => m.sql).join('\n');
    const created = new Set(
      [...all.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)].map((m) =>
        m[1].toLowerCase(),
      ),
    );
    for (const [, dropped] of all.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(\w+)/gi)) {
      created.delete(dropped.toLowerCase());
    }
    const secured = new Set(
      [...all.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(\w+)\s+enable\s+row\s+level\s+security/gi)].map(
        (m) => m[1].toLowerCase(),
      ),
    );
    expect([...created].filter((table) => !secured.has(table)).sort()).toEqual([]);
  });

  it('match their frozen content hashes', () => {
    const drift = migrations
      .filter(({ name, sql }) => FROZEN[name] !== undefined && FROZEN[name] !== sha256(sql))
      .map((m) => m.name);
    expect(drift).toEqual([]);
  });

  it('have a frozen hash for every file, so a new migration is a deliberate act', () => {
    const unfrozen = migrations.map((m) => m.name).filter((name) => FROZEN[name] === undefined);
    expect(unfrozen).toEqual([]);
  });

  it('freeze no hash for a file that no longer exists', () => {
    const names = new Set(migrations.map((m) => m.name));
    expect(Object.keys(FROZEN).filter((name) => !names.has(name))).toEqual([]);
  });
});
