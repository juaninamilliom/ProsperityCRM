import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './pool.js';
import * as schema from './schema.js';

export const db = drizzle(pool, { schema });

export type DB = typeof db;

/** A transaction handle, for services that must run on a caller's transaction
 *  rather than open their own.
 *
 *  Exported because getting this wrong deadlocks the process, not just the
 *  request. `db.transaction` checks a client out of the pool and holds it for
 *  the whole callback, so any statement issued on the module-level `db` from
 *  inside one asks for a SECOND connection while the first is still held.
 *  `pool.ts` defaults to max 10 (PG_POOL_MAX) with no connectionTimeoutMillis, and pg-pool queues
 *  without a timer when that is unset - measured against the real pool, ten
 *  concurrent transactions each wanting a second connection acquired 0 of 10
 *  and waited forever. The pool is shared by every route, so the whole API
 *  stops until the process restarts.
 *
 *  Take this type as a parameter instead, and pass the handle down. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Either one, for a read that works standalone or inside a transaction. */
export type DbOrTx = DB | Tx;

export * from './schema.js';
