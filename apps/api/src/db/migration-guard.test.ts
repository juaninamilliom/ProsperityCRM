import { describe, expect, it } from 'vitest';
import { scanMigration, stripComments } from './migration-guard.js';

/** The guard this replaces had no positive control. It asserted only that the
 *  real migrations were clean, which a broken scanner satisfies just as well
 *  as a clean tree — and it WAS broken: it split on ';' before matching, so
 *  the two-statement form of the exact mistake it existed to catch slipped
 *  through, and so did every dollar-quoted block.
 *
 *  So the corpus below is the point of this file. Each entry is a way someone
 *  could put credentials or PostgREST grants into a migration; the scanner has
 *  to flag every one. The clean cases underneath are the false-positive check,
 *  taken from statements the real migrations actually contain. */

const CAUGHT: Array<[string, string, string]> = [
  [
    'insert-into-users',
    'a default account, the shape that was deleted as 0012',
    "insert into users (email, name, password, role) values ('a@b.c', 'A', 'password', 'OrgAdmin');",
  ],
  [
    'insert-into-users',
    'an insert with the password set by a later statement',
    "insert into users (email, name) values ('a@b.c', 'A');\nupdate users set password = 'letmein' where email = 'a@b.c';",
  ],
  [
    'update-users-password',
    'a password set with no insert anywhere in the file',
    "update users set password = 'letmein' where email = 'a@b.c';",
  ],
  [
    'set-password-literal',
    'a password set from inside a dollar-quoted block',
    "do $$\nbegin\n  update app_users set password = 'letmein';\nend $$;",
  ],
  [
    'grants-orgadmin',
    'an existing account quietly promoted',
    "update users set role = 'OrgAdmin' where email = 'a@b.c';",
  ],
  [
    'create-alter-role-password',
    'a database role with a login password',
    "create role backdoor login password 'hunter2';",
  ],
  [
    'create-alter-role-password',
    'an existing database role given a password',
    "alter role postgres with password 'hunter2';",
  ],
  [
    'postgrest-grant',
    'a direct grant to a PostgREST role',
    'grant all on all tables in schema public to authenticated;',
  ],
  [
    'postgrest-grant',
    'a grant assembled with format(), which this repo already does elsewhere',
    "execute format('grant all on %I to %I;', 'users', 'anon');",
  ],
  [
    'postgrest-grant',
    'a default privilege rather than a grant',
    'alter default privileges in schema public grant select on tables to authenticated;',
  ],
];

const CLEAN: Array<[string, string]> = [
  [
    'the revoke-and-probe block from 0011',
    `DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
  END IF;
END $$;`,
  ],
  [
    'the role backfill in 0003, which names OrgAdmin inside a NOT IN',
    "update users set role = 'OrgEmployee' where role not in ('OrgAdmin', 'OrgEmployee');",
  ],
  [
    'a check constraint naming the roles, as in 0003 and 0004',
    "alter table users add constraint users_role_check check (role in ('OrgAdmin', 'OrgEmployee'));",
  ],
  [
    'a comment mentioning the PostgREST roles, as in 0011 and 0013',
    '-- Revoke all privileges in public from anon and authenticated roles\nselect 1;',
  ],
  [
    'a grant to the connecting role, as 0013 does with format()',
    "execute format('GRANT ALL ON SCHEMA public TO %I;', CURRENT_USER);",
  ],
  ['an ordinary table creation', 'create table if not exists widgets (id uuid primary key);'],
  [
    'seeding a non-user table, as 0002 does',
    "insert into status_config (name, order_index) values ('Sourced', 0) on conflict do nothing;",
  ],
];

describe('stripComments', () => {
  it('removes line comments so their contents cannot trip a rule', () => {
    expect(stripComments('-- grant all to anon\nselect 1;')).not.toMatch(/anon/);
  });

  it('removes block comments', () => {
    expect(stripComments('/* grant all to anon */ select 1;')).not.toMatch(/anon/);
  });

  it('leaves string literals alone, because that is where the evidence lives', () => {
    expect(stripComments("update users set password = 'letmein';")).toMatch(/letmein/);
  });
});

describe('scanMigration', () => {
  describe('catches', () => {
    it.each(CAUGHT)('%s: %s', (rule, _description, sql) => {
      expect(scanMigration(sql)).toContain(rule);
    });
  });

  describe('does not flag', () => {
    it.each(CLEAN)('%s', (_description, sql) => {
      expect(scanMigration(sql)).toEqual([]);
    });
  });
});
