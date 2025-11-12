import type { QueryResult } from 'pg';
import { pool } from '../db/pool';

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
