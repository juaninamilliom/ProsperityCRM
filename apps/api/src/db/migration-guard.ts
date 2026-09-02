/** Scans a migration's SQL for the two things that must never reach a
 *  migration: credentials, and grants to the PostgREST roles.
 *
 *  Migrations run against every database this code is ever pointed at,
 *  production included, on every deploy from main — and the repository is
 *  public. One migration already had to be deleted for writing two admin
 *  accounts with the password "password" into whatever database the runner
 *  was aimed at.
 *
 *  Scans whole files, deliberately. The previous guard split on ';' first,
 *  which meant the two-statement form of that exact mistake matched nothing,
 *  and which also shredded every `DO $$ ... $$` body in the tree. A rule that
 *  cannot span statements cannot catch a mistake spread across two.
 *
 *  These are lints, not proofs. A role name assembled at runtime evades every
 *  pattern here; the proof for the grant rule is a query against the deployed
 *  database:
 *    select grantee, table_name, privilege_type from
 *    information_schema.role_table_grants where grantee in ('anon','authenticated'); */

/** Comments are stripped before scanning, because 0011 and 0013 both describe
 *  the PostgREST roles in prose. String literals are deliberately left alone:
 *  a literal password is the evidence. */
export function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

const PATTERNS: Array<[string, RegExp]> = [
  // No migration has any business creating a user row. Broader than hunting
  // for a password near an insert, and with no false-positive ambiguity: it
  // would have rejected the deleted 0012 on sight.
  ['insert-into-users', /\binsert\s+into\s+users\b/i],
  ['update-users-password', /\bupdate\s+users\b[\s\S]*?\bpassword\s*=/i],
  // Catches a password set on any table, including from inside a DO block.
  ['set-password-literal', /\bset\b[\s\S]{0,200}?\bpassword\s*=\s*'[^']*'/i],
  ['create-alter-role-password', /\b(?:create|alter)\s+role\b[\s\S]*?\bpassword\b/i],
  // Assignment of the privileged value, never mere co-occurrence: 0003
  // legitimately reads `set role = 'OrgEmployee' where role not in ('OrgAdmin', ...)`.
  ['grants-orgadmin', /\brole\s*=\s*(?:'OrgAdmin'|excluded\.role\b)/i],
];

const ROLE_TOKEN = /\b(?:anon|authenticated)\b/gi;
/** The only legitimate mentions: revoking from the role, and probing whether
 *  it exists. Anything else — including a name passed to format() — is a grant
 *  in some disguise. Default-deny, because 0013 already builds grants
 *  dynamically, which is what makes that bypass likely rather than exotic. */
const LEGITIMATE_MENTION = /(?:\bfrom\s+|\brolname\s*=\s*')$/i;

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
