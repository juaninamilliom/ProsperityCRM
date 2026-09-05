/** Turning a Postgres error into a response the caller can act on.
 *
 *  The reason this is a module and not three lines at a call site: drizzle
 *  0.45 wraps EVERY query error in a DrizzleQueryError and hangs the driver's
 *  error off `.cause`. Measured against a real drizzle instance over a
 *  rejecting client:
 *
 *    constructor      DrizzleQueryError
 *    e.code           undefined
 *    e.cause.code     23505
 *
 *  So the obvious `err.code === '23505'` is always false. `company.routes.ts`
 *  did exactly that and re-threw every duplicate into the 500 handler, so its
 *  409 branch - and the web branch that renders it - were both dead code.
 *  `person.routes.ts` worked, but only through the one clause of its six-way
 *  sniff that happened to check `.cause`.
 *
 *  Nothing here reads the driver's text. `message` now contains the SQL and
 *  the bound parameters (candidate emails, LinkedIn URLs) and `detail` spells
 *  out the conflicting row's values, so every string that leaves this module
 *  is one written here. The constraint name may be read to choose a message;
 *  it is never echoed. */

export const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  INVALID_TEXT_REPRESENTATION: '22P02',
} as const;

/** Deadlock (40P01) and serialization failure (40001) are deliberately
 *  unmapped: they are retryable, not caller errors, and belong to a retry
 *  policy this codebase does not have yet. */

export interface PgError {
  code: string;
  constraint?: string;
}

/** The statement that failed. A foreign key violation means opposite things
 *  in each direction, so the caller has to say which. */
export type Operation = 'insert' | 'update' | 'delete' | 'select';

export interface Classified {
  status: number;
  code: 'duplicate' | 'has_dependents' | 'invalid_reference' | 'invalid_id' | 'invalid_value';
  message: string;
}

const MAX_DEPTH = 10;

/** Walks the cause chain rather than taking one hop. One hop is what a naive
 *  implementation does and it would break the moment anything re-wraps. */
export function pgErrorOf(error: unknown): PgError | null {
  let current: unknown = error;
  const seen = new Set<unknown>();

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    if (seen.has(current)) return null; // a cycle, not a chain
    seen.add(current);

    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
      };
    }

    current = candidate.cause;
  }

  return null;
}

export function classify(error: unknown, operation: Operation): Classified | null {
  const pgError = pgErrorOf(error);
  if (!pgError) return null;

  switch (pgError.code) {
    case SQLSTATE.UNIQUE_VIOLATION:
      return { status: 409, code: 'duplicate', message: 'That record already exists.' };

    case SQLSTATE.FOREIGN_KEY_VIOLATION:
      /** The same SQLSTATE, opposite parties at fault. On a delete, something
       *  still references this row and the caller must remove it first. On an
       *  insert or update, the caller pointed at a row that does not exist. */
      return operation === 'delete'
        ? {
            status: 409,
            code: 'has_dependents',
            message: 'Something still refers to this record, so it cannot be deleted.',
          }
        : {
            status: 400,
            code: 'invalid_reference',
            message: 'That request refers to a record that does not exist.',
          };

    case SQLSTATE.INVALID_TEXT_REPRESENTATION:
      /** Every id column is a uuid and no path parameter is validated, so
       *  `GET /companies/not-a-uuid` reaches the driver and 500s today. */
      return { status: 400, code: 'invalid_id', message: 'That identifier is not valid.' };

    case SQLSTATE.CHECK_VIOLATION:
      return { status: 400, code: 'invalid_value', message: 'That value is not allowed here.' };

    default:
      /** Including NOT_NULL_VIOLATION. A missing required column means the
       *  service omitted it, so it is our bug: a 500 is the honest answer and
       *  a 400 would blame the caller for something they could not cause. */
      return null;
  }
}

export interface CompanyDependents {
  people: number;
  requisitions: number;
  entries: number;
  deals: number;
}

const DEPENDENT_NOUNS: Array<[keyof CompanyDependents, string, string]> = [
  ['people', 'contact', 'contacts'],
  ['requisitions', 'requisition', 'requisitions'],
  ['entries', 'pipeline entry', 'pipeline entries'],
  ['deals', 'deal', 'deals'],
];

/** Names every dependent that is actually present, because `message` is the
 *  only field the web reads today. */
export function dependentsMessage(dependents: CompanyDependents): string {
  const parts = DEPENDENT_NOUNS.filter(([key]) => dependents[key] > 0).map(
    ([key, singular, plural]) => `${dependents[key]} ${dependents[key] === 1 ? singular : plural}`
  );

  if (parts.length === 0) return 'This company still has dependent records.';

  return `This company still has ${listPhrase(parts)}.`;
}

/** "a", "a and b", "a, b and c". Shared so that the other delete guards, whose
 *  dependents have different nouns and a different subject, read the same to a
 *  user as this one does. */
export function listPhrase(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
