import { desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, entryStatusHistory, statusConfig } from '../../db/drizzle.js';

const statusFrom = alias(statusConfig, 'status_from');
const statusTo = alias(statusConfig, 'status_to');

export async function getEntryHistory(entryId: string) {
  const result = await db
    .select({
      history_id: entryStatusHistory.history_id,
      entry_id: entryStatusHistory.entry_id,
      from_status_id: entryStatusHistory.from_status_id,
      to_status_id: entryStatusHistory.to_status_id,
      change_date: entryStatusHistory.change_date,
      changed_by: entryStatusHistory.changed_by,
      from_status_name: statusFrom.name,
      to_status_name: statusTo.name,
    })
    .from(entryStatusHistory)
    .leftJoin(statusFrom, eq(entryStatusHistory.from_status_id, statusFrom.status_id))
    .leftJoin(statusTo, eq(entryStatusHistory.to_status_id, statusTo.status_id))
    .where(eq(entryStatusHistory.entry_id, entryId))
    .orderBy(desc(entryStatusHistory.change_date));

  return result;
}

export async function getPlacementMetrics() {
  const result = await db
    .select({
      month: sql<string>`date_trunc('month', ${entryStatusHistory.change_date})`,
      placements: sql<number>`count(*)::int`,
    })
    .from(entryStatusHistory)
    .innerJoin(statusConfig, eq(entryStatusHistory.to_status_id, statusConfig.status_id))
    .where(eq(statusConfig.is_terminal, true))
    .groupBy(sql`date_trunc('month', ${entryStatusHistory.change_date})`)
    .orderBy(desc(sql`date_trunc('month', ${entryStatusHistory.change_date})`));

  return result;
}
