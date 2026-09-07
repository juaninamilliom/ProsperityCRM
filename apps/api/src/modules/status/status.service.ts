import { asc, eq, or, sql } from 'drizzle-orm';
import { db, entryStatusHistory, pipelineEntries, statusConfig } from '../../db/drizzle.js';
import type { StatusConfig } from '../../types.js';
import type { StatusInput } from './status.schema.js';

export async function listStatuses(): Promise<StatusConfig[]> {
  const rows = await db
    .select()
    .from(statusConfig)
    .orderBy(asc(statusConfig.order_index));
  return rows as unknown as StatusConfig[];
}

export async function createStatus(input: StatusInput): Promise<StatusConfig> {
  const [row] = await db
    .insert(statusConfig)
    .values({
      name: input.name,
      order_index: input.order_index,
      is_terminal: input.is_terminal,
    })
    .returning();
  return row as unknown as StatusConfig;
}

export async function updateStatus(id: string, input: StatusInput): Promise<StatusConfig> {
  const [row] = await db
    .update(statusConfig)
    .set({
      name: input.name,
      order_index: input.order_index,
      is_terminal: input.is_terminal,
    })
    .where(eq(statusConfig.status_id, id))
    .returning();
  return row as unknown as StatusConfig;
}

export interface StatusDependents {
  entries: number;
  history: number;
}

/** Counted only after the delete has failed. Both directions of
 *  entry_status_history point at status_config (0010:113-114), and a status
 *  with no live entries can still be undeletable because history rows name it.
 *  That is correct - deleting it would erase the meaning of past transitions -
 *  and the message has to say so, or an admin moves every entry off the status
 *  and gets the same 409 with nothing to act on. */
export async function countStatusDependents(id: string): Promise<StatusDependents> {
  const [entryRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pipelineEntries)
    .where(eq(pipelineEntries.current_status_id, id));

  const [historyRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(entryStatusHistory)
    .where(
      or(eq(entryStatusHistory.from_status_id, id), eq(entryStatusHistory.to_status_id, id))
    );

  return { entries: Number(entryRow?.count ?? 0), history: Number(historyRow?.count ?? 0) };
}

export async function deleteStatus(id: string): Promise<void> {
  await db.delete(statusConfig).where(eq(statusConfig.status_id, id));
}
