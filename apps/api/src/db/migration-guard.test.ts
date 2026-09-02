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
  // Everything below was found by review, after the first version of this
  // scanner shipped claiming to close the finding. Each returned [] then.
  [
    'insert-into-users',
    'the deleted 0012, schema-qualified - one word longer and it walked through',
    "insert into public.users (email, name, password, role) values ('r@x.com','R','password','OrgAdmin');",
  ],
  [
    'insert-into-users',
    'a quoted identifier',
    `insert into "users" (email, password) values ('a','password');`,
  ],
  [
    'insert-with-password-column',
    'an insert ... select, which carries no VALUES tuple to match on',
    "insert into public.users (email, password) select 'a@b.c', 'hunter2';",
  ],
  [
    'insert-into-users',
    'a string literal opening a block comment that swallows the next statement',
    "select 'sneaky /*' as note;\ninsert into users (email, password) values ('a@b.c','password');\nselect '*/' as done;",
  ],
  [
    'set-password-literal',
    'a double dash inside the password itself, which used to eat the closing quote',
    "update app_users set password = 'let--me-in';",
  ],
  // Found by review pass 2, after the first fix for the comment-forging bug
  // shipped claiming to close it. A backslash-escaped quote inside an E'...'
  // string desynchronises the scanner from PostgreSQL by one quote, and from
  // there a literal `--` or `/*` becomes a real comment that deletes the rest.
  [
    'insert-into-users',
    'an E-string whose backslash-escaped quote forges a line comment',
    "insert into audit (note) values (E'c:\\path\\'-- ');\ninsert into users (email, password) values ('root@x.com', 'password');",
  ],
  [
    'insert-into-users',
    'an E-string whose backslash-escaped quote forges a block comment',
    "insert into audit (note) values (E'x\\'/*');\ninsert into users (email, password) values ('a','password');\nselect '*/' as done;",
  ],
  // CREATE USER is a documented alias for CREATE ROLE ... LOGIN, and is the
  // more common spelling. It needed no trickery at all to get past.
  [
    'create-alter-role-password',
    'the USER spelling of CREATE ROLE',
    "create user report_bot with password 'hunter2';",
  ],
  [
    'create-alter-role-password',
    'the USER spelling of ALTER ROLE',
    "alter user postgres with password 'hunter2';",
  ],
  // The table matcher learned about quoting; the column matcher did not.
  [
    'update-users-password',
    'a quoted password column',
    `update users set "password" = '$2b$10$abc' where email = 'a@b.c';`,
  ],
  [
    'merge-or-copy-into-users',
    'MERGE, whose insert clause has no INSERT INTO for the other rules to find',
    'merge into users u using staging s on u.email = s.email ' +
      "when not matched then insert (email, password) values (s.email, 'x');",
  ],
  [
    'merge-or-copy-into-users',
    'COPY, which loads rows without an INSERT at all',
    'copy users (email, password) from stdin;',
  ],
  // Found by review pass 3. The pass-2 fix applied E'...' escape semantics to
  // EVERY literal, but with standard_conforming_strings on (the default since
  // 9.1) '\\' is a complete one-character literal. Over-consuming inverted the
  // scanner's quote parity for the rest of the file, so it ended up OUTSIDE a
  // string where PostgreSQL was inside — losing text, in the exact direction
  // the code comment claimed was impossible.
  [
    'insert-into-users',
    'an ordinary backslash literal that used to invert quote parity',
    "update people set headline = replace(headline, '\\', '');\n" +
      "update people set headline = replace(headline, '--', '-'); " +
      "insert into users (email, password) values ('a','password');",
  ],
  [
    'insert-into-users',
    'the same parity inversion forging an unterminated block comment to EOF',
    "update people set slug = replace(slug, '\\', '-');\nselect 'a/*b';\n" +
      "insert into users (email, password) values ('admin@x','password');",
  ],
  // The pass-2 widening exempted `alter role <r>` wholesale from the grant
  // rule. bypassrls on anon defeats every policy 0011 and 0013 exist to install.
  ['postgrest-grant', 'granting the role a way past every policy', 'alter role anon bypassrls login;'],
  ['postgrest-grant', 'making the role a superuser', 'alter role anon superuser;'],
  // Found by review pass 4. PUBLIC is PostgreSQL's implicit group containing
  // every role present and future, so a grant to it reaches anon and
  // authenticated without ever naming them. 0013 is built out of
  // `GRANT ... IN SCHEMA public TO <role>` lines, so the next author reaching
  // for TO PUBLIC is the accident this guards.
  ['grants-to-public', 'a grant to the implicit group that contains every role', 'grant select on users to public;'],
  [
    'grants-to-public',
    'the default-privileges form',
    'alter default privileges in schema public grant select on tables to public;',
  ],
  // Found by review pass 5. Anchoring on the punctuation after `public` meant
  // the rule only fired when PUBLIC was the last-but-one token.
  ['grants-to-public', 'no trailing semicolon at end of input', 'grant select on t to public'],
  [
    'grants-to-public',
    'WITH GRANT OPTION, which is strictly worse than a plain grant',
    'grant select on t to public with grant option;',
  ],
  ['grants-to-public', 'PUBLIC named second in the role list', 'grant select on t to app_role, public;'],
  ['grants-to-public', 'PUBLIC named second and quoted', 'grant select on t to app_role, "public";'],
  // A three-part name is legal when the first part is the current database.
  [
    'insert-into-users',
    'a three-part table name, the deleted 0012 one qualifier deeper',
    "insert into prosperity_crm.public.users (email, password, role) values ('r@x','password','OrgAdmin');",
  ],
  [
    'update-users-password',
    'a three-part name on the update path, with a function call after the =',
    "update prosperity_crm.public.users set password = crypt('hunter2', gen_salt('bf'));",
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
  // Legitimate hardening SQL that the first version wrongly flagged. These
  // would have blocked the next migration written to close a PostgREST hole.
  [
    'a combined revoke naming both roles, the idiomatic form',
    'revoke all on all tables in schema public from anon, authenticated;',
  ],
  ['a revoke naming a quoted role', 'revoke all on schema public from "anon";'],
  ['dropping the role outright', 'drop role if exists anon;'],
  ['reassigning what the role owns', 'reassign owned by anon to postgres;'],
  // `SET ... TO public` is not a grant. The last one is the standard
  // CVE-2018-1058 mitigation for SECURITY DEFINER functions - exactly what
  // Supabase's advisor tells you to write, and 0013 already chases those.
  ['setting the search path', 'set search_path to public;'],
  ['setting the search path locally', 'set local search_path to public, pg_temp;'],
  [
    'hardening a function against search-path attacks',
    'alter function f() set search_path to public, pg_temp;',
  ],
  ['setting a search path on a role', 'alter role app set search_path to public;'],
  [
    'a grant and a search path in the same file, which must not join up',
    'grant usage on schema public to postgres;\nset search_path to public;',
  ],
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

/** One accepted false positive, recorded so nobody "fixes" it back.
 *
 *  Exempting `alter role <r>` from the grant rule also exempts
 *  `alter role anon bypassrls`, which defeats every policy 0011 and 0013 exist
 *  to install. There is no lookbehind that separates the two, so the exemption
 *  is gone and the legitimate hardening statement is flagged with it.
 *
 *  A flagged migration is a thirty-second conversation. A missed bypassrls is
 *  a breach. */
describe('accepted false positives', () => {
  it('flags alter role nologin, the price of not exempting alter role at all', () => {
    expect(scanMigration('alter role anon nologin;')).toContain('postgrest-grant');
    expect(scanMigration('alter role anon bypassrls login;')).toContain('postgrest-grant');
  });
});
