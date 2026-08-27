import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Migrations run against every database this code is ever pointed at,
 *  production included, and the repository is public. These tests guard
 *  against two mistakes that are invisible in a diff and catastrophic in
 *  a deploy. */

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../infra/db/migrations',
);

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(path.join(migrationsDir, name), 'utf8') }));

/** One SQL statement at a time, so a match cannot span two unrelated statements. */
function statements(sql: string): string[] {
  return sql.split(';');
}

describe('migrations', () => {
  it('are found where the runner looks for them', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('never insert a user with a literal password', () => {
    // A default account belongs in seed.sql, which a developer runs by hand
    // against a database they chose. A migration chooses for them.
    const offenders = migrations
      .filter((m) => statements(m.sql).some((s) => /insert\s+into\s+users\b[\s\S]*\bpassword\b/i.test(s)))
      .map((m) => m.name);
    expect(offenders).toEqual([]);
  });

  it('never grant privileges to the PostgREST roles', () => {
    // Supabase serves any table that anon or authenticated can read over its
    // REST API, to anyone holding the project's public key. The backend
    // connects as postgres and needs neither role.
    const offenders = migrations
      .filter((m) => statements(m.sql).some((s) => /\bgrant\b[\s\S]*\bto\s+(anon|authenticated)\b/i.test(s)))
      .map((m) => m.name);
    expect(offenders).toEqual([]);
  });
});
