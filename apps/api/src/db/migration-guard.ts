/** Scans a migration's SQL for the two things that must never reach a
 *  migration: credentials, and grants to the PostgREST roles.
 *
 *  Migrations run against every database this code is ever pointed at,
 *  production included, on every deploy from main — and the repository is
 *  public. One migration already had to be deleted for writing two admin
 *  accounts with the password "password" into whatever database the runner
 *  was aimed at.
 *
 *  Scans whole files, deliberately. An earlier guard split on ';' first, which
 *  meant the two-statement form of that exact mistake matched nothing, and
 *  which also shredded every `DO $$ ... $$` body in the tree.
 *
 *  These are lints, not proofs. A role name assembled at runtime evades every
 *  pattern here; the proof for the grant rule is a query against the deployed
 *  database:
 *    select grantee, table_name, privilege_type from
 *    information_schema.role_table_grants where grantee in ('anon','authenticated'); */

/** Removes comments without letting a string literal forge one.
 *
 *  This is a small scanner rather than a `.replace()` because a regex cannot
 *  do it correctly, and the failure direction is a false negative. Verified
 *  against the earlier regex version: a statement whose string literal opens
 *  a block comment, an `insert into users ... password ...` after it, and a
 *  later statement whose literal closes that comment. The insert was deleted
 *  before scanning, and the file came back clean.
 *
 *  String literals and dollar-quoted bodies are preserved verbatim: a literal
 *  password is the evidence, and a DO block is real SQL. Block comments nest
 *  in PostgreSQL, and this tracks that. */
export function stripComments(sql: string): string {
  let out = '';
  let i = 0;

  while (i < sql.length) {
    const pair = sql.slice(i, i + 2);

    if (pair === '--') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += ' ';
      continue;
    }

    if (pair === '/*') {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        const inner = sql.slice(i, i + 2);
        if (inner === '/*') {
          depth++;
          i += 2;
        } else if (inner === '*/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      out += ' ';
      continue;
    }

    if (sql[i] === "'") {
      // Only an E'...' string honours backslash escapes; with
      // standard_conforming_strings on (the default since 9.1) '\\' is a
      // complete one-character literal. Treating every literal as escapable
      // over-consumes the closing quote and INVERTS parity for the rest of the
      // file, which loses text rather than preserving it.
      const isEscapeString = /[Ee]$/.test(sql.slice(Math.max(0, i - 1), i)) && !/\w/.test(sql[i - 2] ?? '');
      out += "'";
      i++;
      while (i < sql.length) {
        if (isEscapeString && sql[i] === '\\') {
          out += sql.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            out += "''";
            i += 2;
            continue;
          }
          out += "'";
          i++;
          break;
        }
        out += sql[i];
        i++;
      }
      continue;
    }

    if (sql[i] === '"') {
      out += '"';
      i++;
      while (i < sql.length) {
        out += sql[i];
        const closed = sql[i] === '"';
        i++;
        if (closed) break;
      }
      continue;
    }

    const dollarTag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(sql.slice(i));
    if (dollarTag) {
      const tag = dollarTag[0];
      const close = sql.indexOf(tag, i + tag.length);
      const stop = close === -1 ? sql.length : close + tag.length;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }

    out += sql[i];
    i++;
  }

  return out;
}

/** `users`, `public.users`, `"users"` and `prosperity_crm.public.users` are all
 *  the same table - PostgreSQL accepts a three-part name when the first part
 *  is the current database. Earlier versions matched only the bare word, then
 *  only one qualifier, and the deleted 0012 walked through both. */
const USERS_TABLE = String.raw`(?:(?:"[^"]+"|\w+)\s*\.\s*){0,2}"?users"?`;

const PATTERNS: Array<[string, RegExp]> = [
  // No migration has any business creating a user row. Broader than hunting
  // for a password near an insert, and with no false-positive ambiguity.
  ['insert-into-users', new RegExp(String.raw`\binsert\s+into\s+${USERS_TABLE}\b`, 'i')],
  // Table-agnostic, and catches `insert ... select`, which carries no VALUES
  // tuple for the rules above to match on.
  [
    'insert-with-password-column',
    /\binsert\s+into\b[\s\S]{0,200}?\([^)]*\bpassword\b[^)]*\)/i,
  ],
  ['update-users-password', new RegExp(String.raw`\bupdate\s+${USERS_TABLE}\b[\s\S]*?"?password"?\s*=`, 'i')],
  // Catches a password set on any table, including from inside a DO block.
  ['set-password-literal', /\bset\b[\s\S]{0,200}?"?password"?\s*=\s*'[^']*'/i],
  ['create-alter-role-password', /\b(?:create|alter)\s+(?:role|user|group)\b[\s\S]*?\bpassword\b/i],
  // Assignment of the privileged value, never mere co-occurrence: 0003
  // legitimately reads `set role = 'OrgEmployee' where role not in ('OrgAdmin', ...)`.
  ['grants-orgadmin', /\brole\s*=\s*(?:'OrgAdmin'|excluded\.role\b)/i],
  // MERGE's insert clause carries no INSERT INTO, and COPY loads rows with no
  // INSERT at all. Neither keyword appears in any current migration, so this
  // costs nothing.
  [
    'merge-or-copy-into-users',
    new RegExp(String.raw`\b(?:merge\s+into|copy)\s+${USERS_TABLE}\b`, 'i'),
  ],
  // PUBLIC is PostgreSQL's implicit group containing every role, present and
  // future, so granting to it reaches anon and authenticated without naming
  // them. Anchored on the GRANT statement and walking the role list, rather
  // than on the punctuation after `public`: the punctuation version fired only
  // when PUBLIC was the last-but-one token, so `TO PUBLIC WITH GRANT OPTION`
  // and `TO app_role, PUBLIC` both walked through it.
  //
  // The `[^;]` bound keeps the match inside one statement, which is what stops
  // it joining a legitimate `GRANT ... TO postgres;` to a following
  // `SET search_path TO public;`. That SET form is not a grant at all - it is
  // the standard CVE-2018-1058 mitigation, and the punctuation version flagged
  // the whole family of them.
  [
    'grants-to-public',
    /\bgrant\b[^;]{0,300}?\bto\s+(?:(?:"[^"]+"|[\w$]+)\s*,\s*)*"?public"?(?![\w$])/i,
  ],
];

const ROLE_TOKEN = /\b(?:anon|authenticated)\b/gi;
/** Default-deny on the role names themselves, because 0013 already builds
 *  grants dynamically with `format(... TO %I)` — so banning the grant syntax
 *  would miss `format('... TO %I;', 'anon')`, which is one step from what this
 *  repo already writes.
 *
 *  The allowed mentions are revoking the role, naming it second in a combined
 *  revoke, probing whether it exists, dropping it, and reassigning what it
 *  owns. All are things a migration written to CLOSE a PostgREST hole says.
 *
 *  `alter role <r>` is deliberately NOT exempt, though it was briefly: the
 *  exemption let `alter role anon bypassrls` through, which defeats every
 *  policy 0011 and 0013 exist to install. So `alter role anon nologin` is
 *  flagged too. That is a false positive on a legitimate hardening statement,
 *  and it is the right trade - a flagged migration is a thirty-second
 *  conversation, a missed bypassrls is a breach. */
const LEGITIMATE_MENTION =
  /(?:\bfrom\s+|\brolname\s*=\s*'|\bdrop\s+role\s+(?:if\s+exists\s+)?|\bowned\s+by\s+|\b(?:anon|authenticated)"?\s*,\s*)"?$/i;

function grantsToPostgrestRole(sql: string): boolean {
  ROLE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ROLE_TOKEN.exec(sql)) !== null) {
    const preceding = sql.slice(Math.max(0, match.index - 40), match.index);
    if (!LEGITIMATE_MENTION.test(preceding)) return true;
  }
  return false;
}

/** Returns the labels of every rule the SQL violates. Empty means clean. */
export function scanMigration(sql: string): string[] {
  const stripped = stripComments(sql);
  const violations = PATTERNS.filter(([, pattern]) => pattern.test(stripped)).map(([label]) => label);
  if (grantsToPostgrestRole(stripped)) violations.push('postgrest-grant');
  return violations;
}
