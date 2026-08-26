import { asc, eq } from 'drizzle-orm';
import { db, statusConfig } from '../../db/drizzle.js';
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

export async function deleteStatus(id: string): Promise<void> {
  await db.delete(statusConfig).where(eq(statusConfig.status_id, id));
}
